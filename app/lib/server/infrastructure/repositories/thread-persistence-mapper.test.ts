import { describe, expect, it } from "vitest";
import { DEFAULT_THREAD_INSTRUCTION_CONTEXT_TOGGLES } from "~/lib/domain/value-objects/thread-instruction-context";
import type { PersistedThreadRow } from "~/lib/server/infrastructure/repositories/thread-persistence-mapper";
import { mapThreadRowToThreadSnapshot } from "~/lib/server/infrastructure/repositories/thread-persistence-mapper";

function createPersistedThreadRow(): PersistedThreadRow {
  return {
    id: "thread-a",
    userId: 1,
    name: "Thread A",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    deletedAt: null,
    reasoningEffort: "unsupported",
    webSearchEnabled: true,
    chatAzureConfigJson: JSON.stringify({
      tenantId: "tenant-a",
      projectId: "project-a",
      projectName: "Project A",
      baseUrl: "https://example.openai.azure.com",
      apiVersion: "2026-01-01-preview",
      deploymentName: "gpt-5",
    }),
    agentConversationId: "  conversation-a  ",
    threadEnvironmentJson: "{\"PATH\":\"/tmp/bin\"}",
    instructionContextTogglesJson: "",
    instruction: {
      id: 1,
      threadId: "thread-a",
      content: "Focus on the current workspace.",
    },
    messages: [
      {
        id: "message-a",
        threadId: "thread-a",
        conversationOrder: 0,
        role: "user",
        content: "hello",
        createdAt: "2026-01-01T00:00:00.000Z",
        turnId: "turn-a",
        attachmentsJson:
          '[{"name":"notes.txt","mimeType":"text/plain","sizeBytes":5,"dataUrl":"data:text/plain;base64,aGVsbG8="}]',
        skillActivations: [
          {
            id: "activation-a",
            messageId: "message-a",
            selectionOrder: 0,
            skillProfileId: 10,
            skillProfile: {
              id: 10,
              userId: 1,
              registryProfileId: null,
              name: "skill-a",
              location: "/tmp/skill-a",
              source: "workspace",
            },
          },
        ],
      },
    ],
    mcpServers: [
      {
        id: "server-a",
        threadId: "thread-a",
        selectionOrder: 0,
        name: "Server A",
        transport: "stdio",
        url: null,
        headersJson: null,
        useAzureAuth: false,
        azureAuthScope: null,
        timeoutSeconds: null,
        command: "node",
        argsJson: "[\"mcp.js\"]",
        cwd: "/tmp",
        envJson: "{\"PATH\":\"/usr/bin\"}",
      },
      {
        id: "server-b",
        threadId: "thread-a",
        selectionOrder: 1,
        name: "Server B",
        transport: "streamable_http",
        url: "https://example.com/mcp",
        headersJson: "{\"Authorization\":\"Bearer token\"}",
        useAzureAuth: true,
        azureAuthScope: "https://scope/.default",
        timeoutSeconds: 30,
        command: null,
        argsJson: null,
        cwd: null,
        envJson: null,
      },
    ],
    mcpRpcLogs: [
      {
        rowId: "row-a",
        sourceRpcId: "rpc-a",
        threadId: "thread-a",
        conversationOrder: 0,
        sequence: 1,
        operationType: "mcp",
        serverName: "Server A",
        method: "tools/list",
        startedAt: "2026-01-01T00:00:00.000Z",
        completedAt: "2026-01-01T00:00:01.000Z",
        requestJson: "{\"id\":\"rpc-a\"}",
        responseJson: "{\"ok\":true}",
        isError: false,
        turnId: "turn-a",
      },
    ],
    skillSelections: [
      {
        id: "selection-a",
        threadId: "thread-a",
        selectionOrder: 0,
        skillProfileId: 10,
        skillProfile: {
          id: 10,
          userId: 1,
          registryProfileId: null,
          name: "skill-a",
          location: "/tmp/skill-a",
          source: "workspace",
        },
      },
    ],
  } as PersistedThreadRow;
}

describe("thread-persistence-mapper", () => {
  it("maps persisted rows into a Thread snapshot", () => {
    const snapshot = mapThreadRowToThreadSnapshot(createPersistedThreadRow());

    expect(snapshot).toMatchObject({
      id: "thread-a",
      reasoningEffort: "medium",
      agentConversationId: "conversation-a",
      threadEnvironment: {
        PATH: "/tmp/bin",
      },
      instructionContextToggles: DEFAULT_THREAD_INSTRUCTION_CONTEXT_TOGGLES,
      messages: [
        expect.objectContaining({
          role: "user",
        }),
      ],
      mcpServers: [
        expect.objectContaining({
          transport: "stdio",
        }),
        expect.objectContaining({
          transport: "streamable_http",
        }),
      ],
    });
    expect(snapshot.operationLogs[0]).toMatchObject({
      operationType: "mcp",
      request: {
        id: "rpc-a",
      },
    });
  });
});
