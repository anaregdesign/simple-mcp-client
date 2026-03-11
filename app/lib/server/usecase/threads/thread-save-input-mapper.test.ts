import { describe, expect, it } from "vitest";
import {
  MCP_DEFAULT_AZURE_AUTH_SCOPE,
  MCP_DEFAULT_TIMEOUT_SECONDS,
} from "~/lib/constants/mcp";
import { Thread } from "~/lib/domain/entities/thread";
import type { ThreadSnapshot } from "~/lib/domain/value-objects/thread-snapshot";
import {
  buildThreadSaveInputFromThread,
  mapThreadWritePayloadToSaveInput,
} from "~/lib/server/usecase/threads/thread-save-input-mapper";

function createThreadSnapshot(): ThreadSnapshot {
  return {
    id: "thread-a",
    userId: 1,
    name: "Thread A",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    deletedAt: null,
    reasoningEffort: "medium",
    webSearchEnabled: false,
    chatAzureConfig: {
      tenantId: "tenant-a",
      projectId: "project-a",
      projectName: "Project A",
      baseUrl: "https://example.openai.azure.com",
      apiVersion: "2026-01-01-preview",
      deploymentName: "gpt-5",
    },
    agentConversationId: null,
    threadEnvironment: {
      PATH: "/tmp/bin",
    },
    instructionContextToggles: {
      system: true,
    },
    instruction: null,
    messages: [
      {
        id: "message-a",
        threadId: "thread-a",
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
        skillActivations: [
          {
            id: "activation-a",
            messageId: "message-a",
            selectionOrder: 0,
            skillProfileId: 1,
            skillProfile: {
              id: 1,
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
        transport: "streamable_http",
        url: "https://example.com/mcp",
        headers: {
          Authorization: "Bearer token",
        },
        useAzureAuth: true,
        azureAuthScope: null,
        timeoutSeconds: null,
      },
    ],
    operationLogs: [],
    skillSelections: [
      {
        id: "selection-a",
        threadId: "thread-a",
        selectionOrder: 0,
        skillProfileId: 1,
        skillProfile: {
          id: 1,
          userId: 1,
          registryProfileId: null,
          name: "skill-a",
          location: "/tmp/skill-a",
          source: "workspace",
        },
      },
    ],
  };
}

describe("thread-save-input-mapper", () => {
  it("builds a save input from a Thread aggregate", () => {
    const payload = buildThreadSaveInputFromThread(
      new Thread(createThreadSnapshot()),
      {
        agentConversationId: "conversation-a",
        threadEnvironment: {
          PATH: "/custom/bin",
        },
        operationLogs: [
          {
            id: "rpc-a",
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
        assistantMessage: {
          id: "assistant-a",
          role: "assistant",
          content: "world",
          createdAt: "2026-01-01T00:00:02.000Z",
          turnId: "turn-a",
          attachments: [],
          skillActivations: [],
        },
      },
    );

    expect(payload).toMatchObject({
      id: "thread-a",
      agentConversationId: "conversation-a",
      instructionContent:
        "You are a concise assistant for a local playground app.",
      threadEnvironment: {
        PATH: "/custom/bin",
      },
      skillSelections: [
        {
          name: "skill-a",
          location: "/tmp/skill-a",
        },
      ],
    });
    expect(payload.messages).toHaveLength(2);
    expect(payload.messages[0]?.skillActivations).toEqual([
      {
        name: "skill-a",
        location: "/tmp/skill-a",
      },
    ]);
    expect(payload.mcpServers).toEqual([
      expect.objectContaining({
        transport: "streamable_http",
        azureAuthScope: MCP_DEFAULT_AZURE_AUTH_SCOPE,
        timeoutSeconds: MCP_DEFAULT_TIMEOUT_SECONDS,
      }),
    ]);
    expect(payload.operationLogs).toEqual([
      expect.objectContaining({
        id: "rpc-a",
        turnId: "turn-a",
      }),
    ]);
  });

  it("maps transport payloads without mutating the input", () => {
    const payload = {
      id: "thread-a",
      name: "Thread A",
      createdAt: "2026-01-01T00:00:00.000Z",
      reasoningEffort: "medium" as const,
      webSearchEnabled: false,
      chatAzureConfig: null,
      instruction: {
        content: "Follow the instruction.",
      },
      instructionContextToggles: {
        system: true,
      },
      threadEnvironment: {
        PATH: "/tmp/bin",
      },
      messages: [
        {
          id: "message-a",
          role: "user" as const,
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
          skillActivations: [
            {
              name: "skill-a",
              location: "/tmp/skill-a",
            },
          ],
        },
      ],
      mcpServers: [
        {
          id: "server-a",
          name: "Server A",
          transport: "stdio" as const,
          command: "node",
          args: ["mcp.js"],
          cwd: "/tmp",
          env: {
            PATH: "/usr/bin",
          },
        },
      ],
      mcpRpcLogs: [
        {
          id: "rpc-a",
          sequence: 1,
          operationType: "mcp" as const,
          serverName: "Server A",
          method: "tools/list",
          startedAt: "2026-01-01T00:00:00.000Z",
          completedAt: "2026-01-01T00:00:01.000Z",
          request: null,
          response: null,
          isError: false,
          turnId: "turn-a",
        },
      ],
      skillSelections: [
        {
          name: "skill-a",
          location: "/tmp/skill-a",
        },
      ],
    };

    const saveInput = mapThreadWritePayloadToSaveInput(payload);
    saveInput.threadEnvironment.PATH = "/custom/bin";
    saveInput.messages[0]!.attachments[0]!.name = "updated.txt";

    expect(payload.threadEnvironment.PATH).toBe("/tmp/bin");
    expect(payload.messages[0]!.attachments[0]!.name).toBe("notes.txt");
    expect(saveInput.operationLogs).toEqual(payload.mcpRpcLogs);
  });
});
