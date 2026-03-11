import { describe, expect, it, vi } from "vitest";
import type { ThreadState } from "~/lib/client/usecase/workspace/threads/thread-state";
import { applyThreadNameChange } from "./thread-name-mutation";

function createThreadState(overrides: Partial<ThreadState> = {}): ThreadState {
  return {
    id: "thread-1",
    name: "Thread 1",
    createdAt: "2026-03-10T00:00:00.000Z",
    updatedAt: "2026-03-10T00:00:00.000Z",
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
    ...overrides,
  };
}

describe("thread-name-mutation", () => {
  it("updates thread state and syncs the active thread input", () => {
    const thread = createThreadState();
    const setActiveThreadNameInput = vi.fn();

    const renamedThread = applyThreadNameChange(
      {
        readActiveThreadId: () => "thread-1",
        updateThreadStateById: (_threadId, updater) => {
          updater(thread);
        },
        setActiveThreadNameInput,
      },
      {
        threadId: "thread-1",
        nextName: "Renamed Thread",
      },
    );

    expect(renamedThread).toEqual(
      expect.objectContaining({
        id: "thread-1",
        name: "Renamed Thread",
      }),
    );
    expect(setActiveThreadNameInput).toHaveBeenCalledWith("Renamed Thread");
  });

  it("does not touch the active input when renaming an inactive thread", () => {
    const thread = createThreadState({
      id: "thread-2",
      name: "Thread 2",
    });
    const setActiveThreadNameInput = vi.fn();

    const renamedThread = applyThreadNameChange(
      {
        readActiveThreadId: () => "thread-1",
        updateThreadStateById: (_threadId, updater) => {
          updater(thread);
        },
        setActiveThreadNameInput,
      },
      {
        threadId: "thread-2",
        nextName: "Renamed Thread",
      },
    );

    expect(renamedThread?.name).toBe("Renamed Thread");
    expect(setActiveThreadNameInput).not.toHaveBeenCalled();
  });
});
