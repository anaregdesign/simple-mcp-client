import { describe, expect, it, vi } from "vitest";
import {
  ChatApiClient,
} from "~/lib/client/infrastructure/api/chat-api-client";

describe("ChatApiClient", () => {
  it("posts chat request payloads and returns JSON responses", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("/api/chat");
      expect(init?.method).toBe("POST");
      expect(init?.body).toBe(
        JSON.stringify({
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
        }),
      );

      return new Response(
        JSON.stringify({
          message: "assistant response",
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      );
    });

    const client = new ChatApiClient();
    const result = await client.sendMessage(
      {
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
      },
      { fetchImpl },
    );

    expect(result.response.ok).toBe(true);
    expect(result.payload).toEqual({
      message: "assistant response",
    });
    expect(result.isEventStream).toBe(false);
    expect(result.operationLogCount).toBe(0);
  });

  it("consumes event-stream payloads and counts operation logs", async () => {
    const onProgress = vi.fn();
    const onOperationLogRecord = vi.fn();
    const fetchImpl = vi.fn(async () => {
      return new Response(
        [
          'data: {"type":"progress","message":"Preparing request..."}',
          "",
          'data: {"type":"operation_log","record":{"id":"op-1","sequence":1,"operationType":"mcp","serverName":"debug","method":"tools/call","startedAt":"2026-01-01T00:00:00.000Z","completedAt":"2026-01-01T00:00:01.000Z","request":{},"response":{},"isError":false}}',
          "",
          'data: {"type":"final","message":"done","threadEnvironment":{"foo":"bar"}}',
          "",
          "",
        ].join("\n"),
        {
          status: 200,
          headers: {
            "content-type": "text/event-stream",
          },
        },
      );
    });

    const client = new ChatApiClient();
    const result = await client.sendMessage(
      {
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
      },
      {
        fetchImpl,
        onProgress,
        onOperationLogRecord,
      },
    );

    expect(result.payload).toEqual({
      message: "done",
      threadEnvironment: {
        foo: "bar",
      },
    });
    expect(result.isEventStream).toBe(true);
    expect(result.operationLogCount).toBe(1);
    expect(onProgress).toHaveBeenCalledWith("Preparing request...");
    expect(onOperationLogRecord).toHaveBeenCalledTimes(1);
  });
});
