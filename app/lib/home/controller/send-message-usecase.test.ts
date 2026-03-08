/**
 * Tests for send-message use-case helpers.
 */
import { describe, expect, it, vi } from "vitest";
import {
  applySendResult,
  buildChatRequestPayload,
  consumeChatResponseStream,
  validateSendPreconditions,
} from "~/lib/home/controller/send-message-usecase";

describe("validateSendPreconditions", () => {
  const baseInput = {
    content: "hello",
    threadId: "thread-1",
    isArchivedThread: false,
    isThreadSending: false,
    isThreadPhaseBlockingSend: false,
    isChatLocked: false,
    hasActivePlaygroundAzureConnection: true,
    isAzureAuthRequired: false,
    isLoadingPlaygroundAzureDeployments: false,
    deploymentName: "gpt-5",
    isSelectedDeploymentValid: true,
    isPlaygroundReasoningEffortSupported: true,
    isSelectedPlaygroundReasoningEffortOptionAvailable: true,
    webSearchEnabled: false,
    isPlaygroundReasoningEffortWebSearchCompatible: true,
  };

  it("returns null for valid input", () => {
    expect(validateSendPreconditions(baseInput)).toBeNull();
  });

  it("returns thread_error for missing thread", () => {
    expect(
      validateSendPreconditions({
        ...baseInput,
        threadId: "",
      }),
    ).toEqual({
      type: "thread_error",
      targetTab: "threads",
      message: "Select or create a thread before sending.",
    });
  });

  it("returns ui_error for locked chat", () => {
    expect(
      validateSendPreconditions({
        ...baseInput,
        isChatLocked: true,
      }),
    ).toEqual({
      type: "ui_error",
      targetTab: "settings",
      message: "Playground is unavailable while logged out. Open ⚙️ Settings and sign in.",
    });
  });
});

describe("buildChatRequestPayload", () => {
  const basePayload = {
    threadId: "thread-1",
    turnId: "turn-1",
    message: "hello",
    attachments: [],
    history: [{ role: "assistant" as const, content: "hi" }],
    azureConfig: {
      tenantId: "tenant-a",
      projectName: "project-a",
      baseUrl: "https://example.test/openai/v1/",
      apiVersion: "2026-01-01",
      deploymentName: "gpt-5",
    },
    supportsReasoningEffort: false,
    reasoningEffort: "medium" as const,
    webSearchEnabled: false,
    agentInstruction: "instruction",
    instructionContextToggles: { system: true },
    threadEnvironment: { foo: "bar" },
    skills: [{ name: "Skill A", location: "/skills/a" }],
    explicitSkillLocations: ["/skills/a"],
    mcpServers: [],
  };

  it("omits reasoningEffort when deployment does not support it", () => {
    const payload = buildChatRequestPayload(basePayload);
    expect(payload).not.toHaveProperty("reasoningEffort");
  });

  it("includes reasoningEffort when deployment supports it", () => {
    const payload = buildChatRequestPayload({
      ...basePayload,
      supportsReasoningEffort: true,
      reasoningEffort: "high",
    });
    expect(payload.reasoningEffort).toBe("high");
  });
});

describe("applySendResult", () => {
  const baseState = {
    isSending: false,
    sendProgressMessages: [],
    activeTurnId: null,
    lastErrorTurnId: null,
    error: null,
  };

  it("builds optimistic state", () => {
    expect(
      applySendResult(baseState, {
        status: "optimistic",
        turnId: "turn-1",
      }),
    ).toEqual({
      isSending: true,
      sendProgressMessages: ["Preparing request..."],
      activeTurnId: "turn-1",
      lastErrorTurnId: null,
      error: null,
    });
  });

  it("resets state on cancellation", () => {
    expect(
      applySendResult(
        {
          ...baseState,
          isSending: true,
          activeTurnId: "turn-1",
          sendProgressMessages: ["Thinking..."],
        },
        {
          status: "canceled",
        },
      ),
    ).toEqual(baseState);
  });

  it("maps failed error messages", () => {
    expect(
      applySendResult(baseState, {
        status: "failed",
        turnId: "turn-2",
        error: new Error("network failed"),
      }),
    ).toEqual({
      isSending: false,
      sendProgressMessages: [],
      activeTurnId: null,
      lastErrorTurnId: "turn-2",
      error: "network failed",
    });

    expect(
      applySendResult(baseState, {
        status: "failed",
        turnId: "turn-2",
        error: "unknown",
      }).error,
    ).toBe("Could not reach the server.");
  });
});

describe("consumeChatResponseStream", () => {
  it("consumes event-stream payloads and aggregates operation log count", async () => {
    const onProgress = vi.fn();
    const onOperationLogRecord = vi.fn();

    const result = await consumeChatResponseStream({
      response: new Response("", {
        headers: {
          "content-type": "text/event-stream",
        },
      }),
      readChatEventStreamPayload: async (_response, handlers) => {
        handlers.onProgress("Preparing request...");
        handlers.onOperationLogRecord({
          id: "op-1",
          sequence: 1,
          operationType: "mcp",
          serverName: "debug",
          method: "tools/call",
          startedAt: "2026-01-01T00:00:00.000Z",
          completedAt: "2026-01-01T00:00:01.000Z",
          request: {},
          response: {},
          isError: false,
          turnId: "turn-1",
        });
        handlers.onOperationLogRecord({
          id: "op-2",
          sequence: 2,
          operationType: "mcp",
          serverName: "debug",
          method: "tools/call",
          startedAt: "2026-01-01T00:00:01.000Z",
          completedAt: "2026-01-01T00:00:02.000Z",
          request: {},
          response: {},
          isError: false,
          turnId: "turn-1",
        });
        return {
          message: "done",
        };
      },
      readJsonPayload: async () => ({
        message: "unused",
      }),
      onProgress,
      onOperationLogRecord,
    });

    expect(result).toEqual({
      payload: {
        message: "done",
      },
      isEventStream: true,
      operationLogCount: 2,
    });
    expect(onProgress).toHaveBeenCalledWith("Preparing request...");
    expect(onOperationLogRecord).toHaveBeenCalledTimes(2);
  });

  it("uses JSON payload reader for non-stream responses", async () => {
    const readJsonPayload = vi.fn(async () => ({
      message: "json",
    }));

    const result = await consumeChatResponseStream({
      response: new Response("{}", {
        headers: {
          "content-type": "application/json",
        },
      }),
      readChatEventStreamPayload: async () => ({
        message: "stream",
      }),
      readJsonPayload,
      onProgress: vi.fn(),
      onOperationLogRecord: vi.fn(),
    });

    expect(result).toEqual({
      payload: {
        message: "json",
      },
      isEventStream: false,
      operationLogCount: 0,
    });
    expect(readJsonPayload).toHaveBeenCalledTimes(1);
  });
});
