/**
 * Test module verifying client thread state mapping behavior.
 */
import { describe, expect, it } from "vitest";
import {
  buildThreadSummary,
  convertThreadResourceToState,
  convertThreadStateToWritePayload,
} from "~/lib/client/usecase/workspace/threads/thread-state-mappers";
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

describe("convertThreadResourceToState", () => {
  it("converts a raw thread resource into client thread state", () => {
    const state = convertThreadResourceToState(createThreadResource());

    expect(state.id).toBe("thread-1");
    expect(state.reasoningEffort).toBe("none");
    expect(state.webSearchEnabled).toBe(false);
    expect(state.agentInstruction).toBe("You are concise.");
    expect(state.threadEnvironment).toEqual({
      VIRTUAL_ENV: "/tmp/thread-1/.venv",
    });
    expect(state.messages[0]?.skillActivations).toEqual([
      {
        name: "doc-retriever",
        location: "/skills/doc-retriever/SKILL.md",
      },
    ]);
    expect(state.mcpServers[0]).toEqual({
      id: "mcp-1",
      name: "Local MCP",
      connectOnThreadCreate: false,
      transport: "streamable_http",
      url: "https://example.com/mcp",
      headers: {},
      useAzureAuth: false,
      azureAuthScope: "https://cognitiveservices.azure.com/.default",
      timeoutSeconds: 30,
    });
  });
});

describe("convertThreadStateToWritePayload", () => {
  it("maps client thread state back to the write payload", () => {
    const state = convertThreadResourceToState(createThreadResource());
    const payload = convertThreadStateToWritePayload(state);

    expect(payload.instruction.content).toBe("You are concise.");
    expect(payload.threadEnvironment).toEqual({
      VIRTUAL_ENV: "/tmp/thread-1/.venv",
    });
    expect(payload.messages[0]?.skillActivations).toEqual([
      {
        name: "doc-retriever",
        location: "/skills/doc-retriever/SKILL.md",
      },
    ]);
  });
});

describe("buildThreadSummary", () => {
  it("builds summary counts", () => {
    const summary = buildThreadSummary(convertThreadResourceToState(createThreadResource()));

    expect(summary).toEqual({
      id: "thread-1",
      name: "Thread 1",
      createdAt: "2026-02-20T00:00:00.000Z",
      updatedAt: "2026-02-20T00:00:00.000Z",
      deletedAt: null,
      messageCount: 1,
      mcpServerCount: 1,
    });
  });
});
