/**
 * Tests for send-message use-case helpers.
 */
import { describe, expect, it, vi } from "vitest";
import {
  applySendResult,
  buildChatRequestPayload,
  executeSendMessageTransport,
  prepareSendMessageExecution,
  validateSendPreconditions,
} from "~/lib/client/usecase/workspace/chat-session/usecase";
import type { ThreadState } from "~/lib/contracts/threads/types";

function createThreadState(overrides: Partial<ThreadState> = {}): ThreadState {
  return {
    id: "thread-1",
    name: "Thread 1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    reasoningEffort: "high",
    webSearchEnabled: false,
    agentInstruction: "Instruction",
    instructionContextToggles: {
      system: true,
    },
    threadEnvironment: {},
    messages: [],
    mcpServers: [],
    mcpRpcLogs: [],
    skillSelections: [],
    ...overrides,
  };
}

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

describe("prepareSendMessageExecution", () => {
  it("builds request payload and optimistic user message from runtime state", () => {
    const prepared = prepareSendMessageExecution({
      threadId: "thread-1",
      turnId: "turn-1",
      content: "Explain the refactor plan.",
      draftAttachments: [
        {
          id: "draft-1",
          name: "notes.txt",
          mimeType: "text/plain",
          sizeBytes: 12,
          dataUrl: "data:text/plain;base64,bm90ZXM=",
        },
      ],
      messages: [
        {
          id: "assistant-1",
          role: "assistant",
          content: "Previous response",
          createdAt: "2026-01-01T00:00:00.000Z",
          turnId: "turn-0",
          attachments: [],
          skillActivations: [],
        },
        {
          id: "user-1",
          role: "user",
          content: "Existing attachment message",
          createdAt: "2026-01-01T00:00:01.000Z",
          turnId: "turn-0",
          attachments: [
            {
              name: "history.txt",
              mimeType: "text/plain",
              sizeBytes: 5,
              dataUrl: "data:text/plain;base64,aGlzdG9yeQ==",
            },
          ],
          skillActivations: [],
        },
      ],
      mcpServers: [
        {
          id: "mcp-1",
          name: "Filesystem",
          transport: "streamable_http",
          url: "https://example.com/mcp",
          headers: {},
          useAzureAuth: false,
          azureAuthScope: "https://cognitiveservices.azure.com/.default",
          timeoutSeconds: 30,
          connectOnThreadCreate: false,
        },
      ],
      selectedMessageSkillActivations: [
        {
          name: "message-skill",
          location: "/skills/message",
        },
      ],
      selectedThreadSkills: [
        {
          name: "thread-skill",
          location: "/skills/thread",
        },
      ],
      baseThread: createThreadState(),
      agentInstruction: "Use concise wording.",
      instructionContextToggles: {
        system: true,
      },
      activeAzureTenantId: "tenant-1",
      activePlaygroundAzureConnection: {
        projectName: "Playground Project",
        baseUrl: "https://example.openai.azure.com",
        apiVersion: "2026-01-01-preview",
      },
      deploymentName: "gpt-5",
      isPlaygroundReasoningEffortSupported: true,
      reasoningEffort: "high",
      webSearchEnabled: false,
    });

    expect(prepared.requestPayload).toEqual(
      expect.objectContaining({
        threadId: "thread-1",
        turnId: "turn-1",
        message: "Explain the refactor plan.",
        reasoningEffort: "high",
        explicitSkillLocations: ["/skills/thread", "/skills/message"],
      }),
    );
    expect(prepared.requestPayload.history).toEqual([
      {
        role: "assistant",
        content: "Previous response",
      },
      {
        role: "user",
        content: "Existing attachment message",
        attachments: [
          {
            name: "history.txt",
            mimeType: "text/plain",
            sizeBytes: 5,
            dataUrl: "data:text/plain;base64,aGlzdG9yeQ==",
          },
        ],
      },
    ]);
    expect(prepared.userMessage).toEqual(
      expect.objectContaining({
        role: "user",
        content: "Explain the refactor plan.",
        turnId: "turn-1",
        attachments: [
          {
            name: "notes.txt",
            mimeType: "text/plain",
            sizeBytes: 12,
            dataUrl: "data:text/plain;base64,bm90ZXM=",
          },
        ],
      }),
    );
    expect(prepared.requestMcpServers).toEqual([
      expect.objectContaining({
        name: "Filesystem",
      }),
    ]);
    expect(prepared.requestSkillSelections).toEqual([
      { name: "thread-skill", location: "/skills/thread" },
      { name: "message-skill", location: "/skills/message" },
    ]);
    expect(prepared.shouldRefreshThreadTitleOnFirstMessage).toBe(true);
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

describe("executeSendMessageTransport", () => {
  const baseRequestPayload = {
    threadId: "thread-1",
    turnId: "turn-1",
    message: "hello",
    attachments: [],
    history: [],
    azureConfig: {
      tenantId: "tenant-a",
      projectName: "project-a",
      baseUrl: "https://example.openai.azure.com",
      apiVersion: "v1",
      deploymentName: "gpt-5",
    },
    supportsReasoningEffort: false,
    webSearchEnabled: false,
    agentInstruction: "instruction",
    instructionContextToggles: { system: true },
    threadEnvironment: {},
    skills: [],
    explicitSkillLocations: [],
    mcpServers: [],
  };

  it("returns validated transport results", async () => {
    const sendMessage = vi.fn(async () => ({
      response: new Response(JSON.stringify({ message: "assistant response" }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      }),
      payload: {
        message: "assistant response",
        threadEnvironment: {
          FOO: "bar",
        },
      },
      isEventStream: false,
      operationLogCount: 2,
    }));

    const result = await executeSendMessageTransport(
      {
        sendMessage,
        markAzureAuthRequired: vi.fn(),
      },
      {
        requestPayload: baseRequestPayload,
        requestThreadEnvironment: {
          LOCAL: "1",
        },
        signal: new AbortController().signal,
        onProgress: vi.fn(),
        onOperationLogRecord: vi.fn(),
      },
    );

    expect(result).toEqual({
      assistantMessage: "assistant response",
      threadEnvironment: {
        FOO: "bar",
      },
      operationLogCount: 2,
      usedEventStream: false,
    });
  });

  it("marks Azure auth required before throwing API errors", async () => {
    const markAzureAuthRequired = vi.fn();

    await expect(
      executeSendMessageTransport(
        {
          sendMessage: vi.fn(async () => ({
            response: new Response(
              JSON.stringify({
                error: "Azure login is required.",
                errorCode: "azure_login_required",
              }),
              {
                status: 401,
                headers: {
                  "content-type": "application/json",
                },
              },
            ),
            payload: {
              error: "Azure login is required.",
              errorCode: "azure_login_required" as const,
            },
            isEventStream: false,
            operationLogCount: 0,
          })),
          markAzureAuthRequired,
        },
        {
          requestPayload: baseRequestPayload,
          requestThreadEnvironment: {},
          signal: new AbortController().signal,
          onProgress: vi.fn(),
          onOperationLogRecord: vi.fn(),
        },
      ),
    ).rejects.toThrow("Azure login is required.");

    expect(markAzureAuthRequired).toHaveBeenCalledTimes(1);
  });
});
