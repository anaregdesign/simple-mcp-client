import { describe, expect, it } from "vitest";
import {
  ThreadRecord,
  type ThreadRecordSnapshot,
} from "~/lib/domain/entities/thread-record";
import {
  presentThreadResource,
  presentThreadResources,
} from "~/lib/server/http/threads/thread-resource-presentation";

function createThreadSnapshot(threadId = "thread-a"): ThreadRecordSnapshot {
  return {
    id: threadId,
    userId: 1,
    name: "Thread A",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    deletedAt: null,
    reasoningEffort: "medium",
    webSearchEnabled: true,
    threadEnvironment: {
      PROJECT: "local-playground",
    },
    instructionContextToggles: {
      system: true,
    },
    instruction: {
      id: 1,
      threadId,
      content: "Focus on the current workspace.",
    },
    messages: [
      {
        id: "message-a",
        threadId,
        conversationOrder: 0,
        role: "user",
        content: "hello",
        createdAt: "2026-01-01T00:00:00.000Z",
        turnId: "turn-a",
        attachments: [
          {
            name: "notes.txt",
            mimeType: "text/plain",
            sizeBytes: 5,
            dataUrl: "data:text/plain;base64,aGVsbG8=",
          },
        ],
        skillActivations: [],
      },
    ],
    mcpServers: [
      {
        id: "server-a",
        threadId,
        selectionOrder: 0,
        name: "Server A",
        transport: "stdio",
        command: "node",
        args: ["mcp.js"],
        cwd: "/tmp",
        env: {
          PATH: "/usr/bin",
        },
      },
      {
        id: "server-b",
        threadId,
        selectionOrder: 1,
        name: "Server B",
        transport: "streamable_http",
        url: "https://example.com/mcp",
        headers: {
          Authorization: "Bearer token",
        },
        useAzureAuth: true,
        azureAuthScope: "https://scope/.default",
        timeoutSeconds: 30,
      },
    ],
    mcpRpcLogs: [
      {
        rowId: "row-a",
        sourceRpcId: "rpc-a",
        threadId,
        conversationOrder: 0,
        sequence: 1,
        operationType: "mcp",
        serverName: "Server A",
        method: "tools/list",
        startedAt: "2026-01-01T00:00:00.000Z",
        completedAt: "2026-01-01T00:00:01.000Z",
        request: {
          id: "rpc-a",
        },
        response: {
          ok: true,
        },
        isError: false,
        turnId: "turn-a",
      },
    ],
    skillSelections: [],
  };
}

describe("thread-resource-presentation", () => {
  it("serializes a thread snapshot into a transport resource", () => {
    expect(
      presentThreadResource(new ThreadRecord(createThreadSnapshot())),
    ).toMatchObject({
      id: "thread-a",
      reasoningEffort: "medium",
      threadEnvironmentJson: "{\"PROJECT\":\"local-playground\"}",
      instructionContextTogglesJson: "{\"system\":true}",
      messages: [
        expect.objectContaining({
          attachmentsJson:
            '[{"name":"notes.txt","mimeType":"text/plain","sizeBytes":5,"dataUrl":"data:text/plain;base64,aGVsbG8="}]',
        }),
      ],
      mcpServers: [
        expect.objectContaining({
          transport: "stdio",
          argsJson: "[\"mcp.js\"]",
          envJson: "{\"PATH\":\"/usr/bin\"}",
        }),
        expect.objectContaining({
          transport: "streamable_http",
          headersJson: "{\"Authorization\":\"Bearer token\"}",
        }),
      ],
      mcpRpcLogs: [
        expect.objectContaining({
          requestJson: "{\"id\":\"rpc-a\"}",
          responseJson: "{\"ok\":true}",
        }),
      ],
    });
  });

  it("serializes lists of thread snapshots", () => {
    expect(
      presentThreadResources([
        new ThreadRecord(createThreadSnapshot("thread-a")),
        new ThreadRecord(createThreadSnapshot("thread-b")),
      ]).map((thread) => thread.id),
    ).toEqual(["thread-a", "thread-b"]);
  });
});
