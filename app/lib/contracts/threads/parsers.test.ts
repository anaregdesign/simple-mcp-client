/**
 * Test module verifying thread parser behavior.
 */
import { describe, expect, it } from "vitest";
import {
  readThreadResourceFromUnknown,
  readThreadResourceList,
  readThreadWritePayloadFromUnknown,
} from "~/lib/contracts/threads/parsers";
import type { ThreadResource } from "~/lib/contracts/threads/types";

function createThreadResource(): ThreadResource {
  return {
    id: "thread-1",
    userId: 10,
    name: "Thread 1",
    createdAt: "2026-02-20T00:00:00.000Z",
    updatedAt: "2026-02-20T00:00:00.000Z",
    deletedAt: null,
    reasoningEffort: "none",
    webSearchEnabled: false,
    threadEnvironmentJson: JSON.stringify({
      VIRTUAL_ENV: "/tmp/thread-1/.venv",
    }),
    instructionContextTogglesJson: JSON.stringify({
      system: true,
    }),
    instruction: {
      id: 1,
      threadId: "thread-1",
      content: "You are concise.",
    },
    messages: [
      {
        id: "assistant-1",
        threadId: "thread-1",
        conversationOrder: 0,
        role: "assistant",
        content: "Hi",
        createdAt: "2026-02-20T00:00:00.000Z",
        turnId: "turn-1",
        attachmentsJson: "[]",
        skillActivations: [
          {
            id: "message-skill-1",
            messageId: "assistant-1",
            selectionOrder: 0,
            skillProfileId: 101,
            skillProfile: {
              id: 101,
              userId: 10,
              registryProfileId: null,
              name: "doc-retriever",
              location: "/skills/doc-retriever/SKILL.md",
              source: "codex_home",
            },
          },
        ],
      },
    ],
    mcpServers: [
      {
        id: "mcp-1",
        threadId: "thread-1",
        selectionOrder: 0,
        name: "Local MCP",
        transport: "streamable_http",
        url: "https://example.com/mcp",
        headersJson: "{}",
        useAzureAuth: false,
        azureAuthScope: "https://cognitiveservices.azure.com/.default",
        timeoutSeconds: 30,
        command: null,
        argsJson: null,
        cwd: null,
        envJson: null,
      },
    ],
    mcpRpcLogs: [
      {
        rowId: "rpc-1",
        sourceRpcId: "rpc-1",
        threadId: "thread-1",
        conversationOrder: 0,
        sequence: 1,
        operationType: "mcp",
        serverName: "Local MCP",
        method: "tools/list",
        startedAt: "2026-02-20T00:00:01.000Z",
        completedAt: "2026-02-20T00:00:02.000Z",
        requestJson: "{\"jsonrpc\":\"2.0\"}",
        responseJson: "{\"jsonrpc\":\"2.0\"}",
        isError: false,
        turnId: "turn-1",
      },
    ],
    skillSelections: [
      {
        id: "thread-skill-1",
        threadId: "thread-1",
        selectionOrder: 0,
        skillProfileId: 202,
        skillProfile: {
          id: 202,
          userId: 10,
          registryProfileId: null,
          name: "workspace-skill",
          location: "/Users/hiroki/.codex/skills/workspace-skill/SKILL.md",
          source: "codex_home",
        },
      },
    ],
  };
}

describe("readThreadResourceFromUnknown", () => {
  it("parses a valid raw thread resource", () => {
    const parsed = readThreadResourceFromUnknown(createThreadResource());

    expect(parsed).not.toBeNull();
    expect(parsed?.id).toBe("thread-1");
    expect(parsed?.userId).toBe(10);
    expect(parsed?.messages).toHaveLength(1);
    expect(parsed?.mcpRpcLogs).toHaveLength(1);
  });

  it("returns null for invalid raw resources", () => {
    expect(readThreadResourceFromUnknown({ id: "thread-1" })).toBeNull();
    expect(readThreadResourceFromUnknown("invalid")).toBeNull();
  });
});

describe("readThreadWritePayloadFromUnknown", () => {
  it("parses a valid thin thread write payload", () => {
    const parsed = readThreadWritePayloadFromUnknown({
      id: "thread-1",
      name: "Thread 1",
      createdAt: "2026-02-20T00:00:00.000Z",
      reasoningEffort: "none",
      webSearchEnabled: false,
      instruction: {
        content: "You are concise.",
      },
      instructionContextToggles: {
        system: true,
      },
      threadEnvironment: {
        VIRTUAL_ENV: "/tmp/thread-1/.venv",
      },
      messages: [
        {
          id: "assistant-1",
          role: "assistant",
          content: "Hi",
          createdAt: "2026-02-20T00:00:00.000Z",
          turnId: "turn-1",
          attachments: [],
          skillActivations: [
            {
              name: "doc-retriever",
              location: "/skills/doc-retriever/SKILL.md",
            },
          ],
        },
      ],
      mcpServers: [
        {
          id: "mcp-1",
          name: "Local MCP",
          transport: "streamable_http",
          url: "https://example.com/mcp",
          headers: {},
          useAzureAuth: false,
          azureAuthScope: "https://cognitiveservices.azure.com/.default",
          timeoutSeconds: 30,
        },
      ],
      mcpRpcLogs: [
        {
          id: "rpc-1",
          sequence: 1,
          operationType: "mcp",
          serverName: "Local MCP",
          method: "tools/list",
          startedAt: "2026-02-20T00:00:01.000Z",
          completedAt: "2026-02-20T00:00:02.000Z",
          request: { jsonrpc: "2.0" },
          response: { jsonrpc: "2.0" },
          isError: false,
          turnId: "turn-1",
        },
      ],
      skillSelections: [
        {
          name: "workspace-skill",
          location: "/Users/hiroki/.codex/skills/workspace-skill/SKILL.md",
        },
      ],
    });

    expect(parsed).not.toBeNull();
    expect(parsed?.instruction.content).toBe("You are concise.");
    expect(parsed?.messages).toHaveLength(1);
    expect(parsed?.mcpServers).toHaveLength(1);
  });

  it("rejects persistence-only fields in thin thread write payloads", () => {
    expect(
      readThreadWritePayloadFromUnknown({
        id: "thread-1",
        name: "Thread 1",
        createdAt: "2026-02-20T00:00:00.000Z",
        reasoningEffort: "none",
        webSearchEnabled: false,
        instruction: {
          content: "",
        },
        instructionContextToggles: {
          system: true,
        },
        threadEnvironment: {},
        userId: 10,
      }),
    ).toBeNull();
  });
});

describe("readThreadResourceList", () => {
  it("filters invalid entries and deduplicates ids", () => {
    const list = readThreadResourceList([
      createThreadResource(),
      {
        ...createThreadResource(),
        name: "Duplicate",
      },
      {
        id: "",
      },
    ]);

    expect(list).toHaveLength(1);
    expect(list[0]?.name).toBe("Thread 1");
  });
});
