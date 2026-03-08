import { describe, expect, it } from "vitest";
import { Thread } from "~/lib/domain/threads/thread";
import { ThreadMessage } from "~/lib/domain/threads/thread-message";
import { ThreadMcpConnection } from "~/lib/domain/threads/thread-mcp-connection";

describe("Thread", () => {
  it("normalizes required fields and serializes back to a snapshot", () => {
    const thread = new Thread({
      id: " thread-1 ",
      name: " Example Thread ",
      createdAt: "2026-03-09T00:00:00.000Z",
      updatedAt: "2026-03-09T00:00:01.000Z",
      deletedAt: null,
      reasoningEffort: "medium",
      webSearchEnabled: true,
      agentInstruction: "Be precise.",
      instructionContextToggles: {
        system: true,
      },
      threadEnvironment: {
        WORKSPACE_ID: "demo",
      },
      messages: [
        {
          id: "message-1",
          role: "user",
          content: "Hello",
          createdAt: "2026-03-09T00:00:00.000Z",
          turnId: "turn-1",
          attachments: [],
          skillActivations: [],
        },
      ],
      mcpServers: [
        {
          id: "server-1",
          name: "openai-docs",
          transport: "streamable_http",
          url: "https://developers.openai.com/mcp",
          headers: {},
          useAzureAuth: false,
          azureAuthScope: "https://example/.default",
          timeoutSeconds: 30,
        },
      ],
      mcpRpcLogs: [],
      skillSelections: [],
    });

    expect(thread.id).toBe("thread-1");
    expect(thread.name).toBe("Example Thread");
    expect(thread.isArchived()).toBe(false);
    expect(thread.messages[0]).toBeInstanceOf(ThreadMessage);
    expect(thread.mcpServers[0]).toBeInstanceOf(ThreadMcpConnection);
    expect(thread.toSnapshot()).toMatchObject({
      id: "thread-1",
      name: "Example Thread",
      threadEnvironment: {
        WORKSPACE_ID: "demo",
      },
    });
  });

  it("throws when required identifiers are missing", () => {
    expect(
      () =>
        new Thread({
          id: "",
          name: "Example",
          createdAt: "2026-03-09T00:00:00.000Z",
          updatedAt: "2026-03-09T00:00:01.000Z",
          deletedAt: null,
          reasoningEffort: "none",
          webSearchEnabled: false,
          agentInstruction: "",
          instructionContextToggles: {
            system: true,
          },
          threadEnvironment: {},
          messages: [],
          mcpServers: [],
          mcpRpcLogs: [],
          skillSelections: [],
        }),
    ).toThrow("Thread id is required.");
  });
});
