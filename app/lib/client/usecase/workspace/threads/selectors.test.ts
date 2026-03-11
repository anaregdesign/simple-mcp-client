import { describe, expect, it } from "vitest";
import {
  selectThreadViewModel,
} from "~/lib/client/usecase/workspace/threads/selectors";
import type { ThreadState } from "~/lib/client/usecase/workspace/threads/thread-state";

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

describe("selectThreadViewModel", () => {
  it("builds active and archived thread options while exposing active thread state", () => {
    const activeThread = createThreadState({
      id: "thread-1",
      name: "First",
      messages: [
        {
          id: "message-1",
          role: "user",
          content: "Hello",
          createdAt: "2026-01-01T00:00:00.000Z",
          turnId: "turn-1",
          attachments: [],
          skillActivations: [],
        },
      ],
      mcpServers: [
        {
          id: "server-1",
          name: "Saved Server",
          transport: "streamable_http",
          url: "https://example.com/mcp",
          headers: {},
          useAzureAuth: false,
          azureAuthScope: "",
          timeoutSeconds: 30,
        },
      ],
      skillSelections: [
        {
          name: "Skill A",
          location: "/skills/a",
        },
      ],
    });
    const archivedThread = createThreadState({
      id: "thread-2",
      name: "Archived",
      deletedAt: "2026-01-02T00:00:00.000Z",
    });

    const viewModel = selectThreadViewModel({
      threads: [activeThread, archivedThread],
      activeThreadId: "thread-1",
      activeThreadNameInput: "Renamed Thread",
      threadRequestStateById: {
        "thread-2": {
          isSending: true,
          sendProgressMessages: [],
          activeTurnId: null,
          lastErrorTurnId: null,
          error: null,
        },
      },
    });

    expect(viewModel.activeThreadState).toEqual(activeThread);
    expect(viewModel.messages).toEqual(activeThread.messages);
    expect(viewModel.mcpServers).toEqual(activeThread.mcpServers);
    expect(viewModel.selectedThreadSkills).toEqual(activeThread.skillSelections);
    expect(viewModel.isActiveThreadArchived).toBe(false);
    expect(viewModel.activeThreadOptions).toEqual([
      {
        id: "thread-1",
        name: "Renamed Thread",
        updatedAt: "2026-01-01T00:00:00.000Z",
        deletedAt: null,
        messageCount: 1,
        mcpServerCount: 1,
        isAwaitingResponse: false,
      },
    ]);
    expect(viewModel.archivedThreadOptions).toEqual([
      {
        id: "thread-2",
        name: "Archived",
        updatedAt: "2026-01-01T00:00:00.000Z",
        deletedAt: "2026-01-02T00:00:00.000Z",
        messageCount: 0,
        mcpServerCount: 0,
        isAwaitingResponse: true,
      },
    ]);
  });

  it("falls back to initial messages when the active thread is missing", () => {
    const viewModel = selectThreadViewModel({
      threads: [],
      activeThreadId: "",
      activeThreadNameInput: "",
      threadRequestStateById: {},
    });

    expect(viewModel.activeThreadState).toBeNull();
    expect(viewModel.messages).toEqual([]);
    expect(viewModel.activeThreadOptions).toEqual([]);
    expect(viewModel.archivedThreadOptions).toEqual([]);
  });
});
