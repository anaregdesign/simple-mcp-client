import { describe, expect, it } from "vitest";
import {
  buildThreadStateFromCurrentState,
  createLocalThreadState,
  resolveThreadNameForSave,
  setThreadSaveSignatures,
  shouldPersistThreadState,
} from "~/lib/client/usecase/workspace/threads/local-thread-state";
import type { ThreadState } from "~/lib/contracts/threads/types";

describe("threads/local-thread-state", () => {
  it("creates a local thread with default MCP connections", () => {
    const thread = createLocalThreadState({
      name: "  Custom Name  ",
      defaultThreadMcpServers: [
        {
          id: "mcp-1",
          name: "Saved server",
          transport: "streamable_http",
          url: "https://example.com",
          headers: {},
          useAzureAuth: false,
          azureAuthScope: "",
          timeoutSeconds: 60,
          connectOnThreadCreate: true,
        },
      ],
      createThreadId: () => "thread-1",
      now: () => "2026-03-10T00:00:00.000Z",
    });

    expect(thread.id).toBe("thread-1");
    expect(thread.name).toBe("Custom Name");
    expect(thread.mcpServers).toHaveLength(1);
    expect(thread.messages).toEqual([]);
  });

  it("builds a persisted thread snapshot from current state", () => {
    const base: ThreadState = {
      id: "thread-1",
      name: "Old",
      createdAt: "2026-03-09T00:00:00.000Z",
      updatedAt: "2026-03-09T00:00:00.000Z",
      deletedAt: null,
      reasoningEffort: "medium",
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
    };

    const next = buildThreadStateFromCurrentState(base, {
      includeDraftName: true,
      activeThreadNameInput: "New Name",
      reasoningEffort: "high",
      webSearchEnabled: true,
      agentInstruction: "Do it",
      instructionContextToggles: base.instructionContextToggles,
      messages: [
        {
          id: "msg-1",
          role: "user",
          content: "hello",
          createdAt: "2026-03-10T00:00:00.000Z",
          turnId: "turn-1",
          attachments: [],
          skillActivations: [],
        },
      ],
      mcpServers: [],
      mcpRpcLogs: [],
      selectedThreadSkills: [],
      now: () => "2026-03-10T01:00:00.000Z",
    });

    expect(next.name).toBe("New Name");
    expect(next.updatedAt).toBe("2026-03-10T01:00:00.000Z");
    expect(next.reasoningEffort).toBe("high");
    expect(next.messages).toHaveLength(1);
  });

  it("tracks save signatures and persistence eligibility", () => {
    const signatureMap = new Map<string, string>();
    const threads: ThreadState[] = [
      {
        id: "thread-1",
        name: "Thread",
        createdAt: "2026-03-09T00:00:00.000Z",
        updatedAt: "2026-03-09T00:00:00.000Z",
        deletedAt: null,
        reasoningEffort: "medium",
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
      },
    ];

    setThreadSaveSignatures(signatureMap, threads);
    expect(signatureMap.has("thread-1")).toBe(true);
    expect(shouldPersistThreadState(threads[0], signatureMap)).toBe(true);
    expect(resolveThreadNameForSave("Base", false, " Draft ")).toBe("Base");
  });
});
