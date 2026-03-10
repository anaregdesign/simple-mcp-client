import { beforeEach, describe, expect, it, vi } from "vitest";
import { threadsApiClient } from "~/lib/client/infrastructure/api/threads-api-client";
import {
  cancelThreadProcessing,
  clearThread,
  createThreadAndSwitch,
  deleteThread,
  renameThread,
  switchThread,
} from "~/lib/client/usecase/workspace/threads/thread-lifecycle-operations";
import type {
  ThreadLifecycleHandlerDependencies,
} from "~/lib/client/usecase/workspace/threads/thread-lifecycle-types";
import type { ThreadResource } from "~/lib/contracts/threads/types";
import type { ThreadState } from "~/lib/client/usecase/workspace/threads/thread-state";
import {
  DEFAULT_THREAD_INSTRUCTION_CONTEXT_TOGGLES,
} from "~/lib/domain/value-objects/thread-instruction-context";

vi.mock("~/lib/client/infrastructure/api/threads-api-client", () => ({
  threadsApiClient: {
    deleteThread: vi.fn(),
    restoreThread: vi.fn(),
  },
}));

function createThread(overrides: Partial<ThreadState> = {}): ThreadState {
  return {
    id: "thread-1",
    name: "Thread 1",
    createdAt: "2026-03-10T00:00:00.000Z",
    updatedAt: "2026-03-10T00:00:00.000Z",
    deletedAt: null,
    reasoningEffort: "medium",
    webSearchEnabled: false,
    messages: [],
    mcpServers: [],
    mcpRpcLogs: [],
    agentInstruction: "",
    instructionContextToggles: DEFAULT_THREAD_INSTRUCTION_CONTEXT_TOGGLES,
    threadEnvironment: {},
    skillSelections: [],
    ...overrides,
  };
}

function createThreadResource(
  overrides: Partial<ThreadResource> = {},
): ThreadResource {
  return {
    id: "thread-1",
    userId: 1,
    name: "Thread 1",
    createdAt: "2026-03-10T00:00:00.000Z",
    updatedAt: "2026-03-10T00:00:00.000Z",
    deletedAt: null,
    reasoningEffort: "medium",
    webSearchEnabled: false,
    chatAzureConfigJson: null,
    threadEnvironmentJson: "{}",
    instructionContextTogglesJson: JSON.stringify(
      DEFAULT_THREAD_INSTRUCTION_CONTEXT_TOGGLES,
    ),
    instruction: {
      id: 1,
      threadId: "thread-1",
      content: "",
    },
    messages: [],
    mcpServers: [],
    mcpRpcLogs: [],
    skillSelections: [],
    ...overrides,
  };
}

function createDependencies(
  overrides: Partial<ThreadLifecycleHandlerDependencies> = {},
): ThreadLifecycleHandlerDependencies {
  const threads = [createThread()];

  return {
    isSending: false,
    threadOperationPhase: "idle",
    readThreads: () => threads,
    readActiveThreadId: () => "thread-1",
    beginThreadOperation: vi.fn().mockReturnValue(true),
    endThreadOperation: vi.fn(),
    readThreadRequestState: vi.fn().mockReturnValue({ isSending: false }),
    updateThreadStateById: vi.fn(),
    updateThreadsState: vi.fn((updater) => updater(threads)),
    hasSavedThreadSignature: vi.fn().mockReturnValue(false),
    setThreadsReady: vi.fn(),
    rememberThreadSaveSignature: vi.fn(),
    applyThreadState: vi.fn(),
    clearActiveThreadState: vi.fn(),
    buildThreadStateFromCurrentState: vi.fn((thread) => thread),
    saveThreadStateToDatabase: vi.fn().mockResolvedValue(true),
    flushActiveThreadState: vi.fn().mockResolvedValue(true),
    cancelThreadInProgressProcessing: vi.fn().mockReturnValue(false),
    createLocalThreadState: vi.fn(() => createThread({ id: "thread-2" })),
    loadThreads: vi.fn().mockResolvedValue(undefined),
    removeThreadRequestState: vi.fn(),
    setThreadError: vi.fn(),
    setSystemNotice: vi.fn(),
    setActiveMainTab: vi.fn(),
    setActiveThreadNameInput: vi.fn(),
    markAzureAuthRequired: vi.fn(),
    logClientInfo: vi.fn(),
    logClientError: vi.fn(),
    ...overrides,
  };
}

describe("thread lifecycle operations", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-10T12:00:00.000Z"));
    vi.mocked(threadsApiClient.deleteThread).mockReset();
    vi.mocked(threadsApiClient.restoreThread).mockReset();
  });

  it("clears active thread messages and applies the snapshot", async () => {
    const deps = createDependencies({
      readThreads: () => [
        createThread({
          messages: [
            {
              id: "message-1",
              role: "user",
              content: "hello",
              createdAt: "2026-03-10T00:00:00.000Z",
              turnId: "turn-1",
              attachments: [],
              skillActivations: [],
            },
          ],
          mcpRpcLogs: [
            {
              id: "log-1",
              sequence: 1,
              operationType: "mcp",
              serverName: "filesystem",
              method: "readFile",
              startedAt: "2026-03-10T00:00:00.000Z",
              completedAt: "2026-03-10T00:00:01.000Z",
              request: null,
              response: null,
              isError: false,
              turnId: "turn-1",
            },
          ],
        }),
      ],
    });

    await clearThread(deps, "thread-1");

    expect(deps.updateThreadsState).toHaveBeenCalled();
    expect(deps.removeThreadRequestState).toHaveBeenCalledWith("thread-1");
    expect(deps.applyThreadState).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "thread-1",
        messages: [],
        mcpRpcLogs: [],
      }),
    );
    expect(deps.saveThreadStateToDatabase).toHaveBeenCalled();
    expect(deps.endThreadOperation).toHaveBeenCalledWith("clearing");
  });

  it("switches to the requested thread after flushing the active snapshot", async () => {
    const nextThread = createThread({ id: "thread-2", name: "Thread 2" });
    const deps = createDependencies({
      readThreads: () => [createThread(), nextThread],
      readActiveThreadId: () => "thread-1",
    });

    await switchThread(deps, "thread-2");

    expect(deps.flushActiveThreadState).toHaveBeenCalled();
    expect(deps.applyThreadState).toHaveBeenCalledWith(nextThread);
    expect(deps.logClientInfo).toHaveBeenCalledWith(
      "switch_thread_succeeded",
      "Thread switched.",
      expect.objectContaining({
        context: expect.objectContaining({
          fromThreadId: "thread-1",
          toThreadId: "thread-2",
        }),
      }),
    );
    expect(deps.endThreadOperation).toHaveBeenCalledWith("switching");
  });

  it("creates and applies a local thread when the current snapshot is persistable", async () => {
    const nextThread = createThread({ id: "thread-2", name: "New Thread" });
    const deps = createDependencies({
      createLocalThreadState: vi.fn(() => nextThread),
      hasSavedThreadSignature: vi.fn().mockReturnValue(true),
      buildThreadStateFromCurrentState: vi.fn((thread) => thread),
      readThreads: () => [createThread({ messages: [{ id: "message-1", role: "user", content: "hello", createdAt: "2026-03-10T00:00:00.000Z", turnId: "turn-1", attachments: [], skillActivations: [] }] })],
    });

    const created = await createThreadAndSwitch(deps, { name: "New Thread" });

    expect(created).toBe(true);
    expect(deps.flushActiveThreadState).toHaveBeenCalled();
    expect(deps.updateThreadsState).toHaveBeenCalled();
    expect(deps.applyThreadState).toHaveBeenCalledWith(nextThread);
    expect(deps.endThreadOperation).toHaveBeenCalledWith("creating");
  });

  it("renames the active thread and persists the snapshot", async () => {
    const deps = createDependencies({
      readThreads: () => [createThread({ name: "Old Name" })],
    });

    await renameThread(deps, "thread-1", "New Name");

    expect(deps.updateThreadStateById).toHaveBeenCalledWith(
      "thread-1",
      expect.any(Function),
    );
    expect(deps.setActiveThreadNameInput).toHaveBeenCalledWith("New Name");
    expect(deps.saveThreadStateToDatabase).toHaveBeenCalled();
  });

  it("removes an unsaved empty active thread from local state", async () => {
    let threads = [createThread()];
    const deps = createDependencies({
      readThreads: () => threads,
      updateThreadsState: vi.fn((updater) => {
        threads = updater(threads);
        return threads;
      }),
      hasSavedThreadSignature: vi.fn().mockReturnValue(false),
      readActiveThreadId: () => "thread-1",
    });

    await deleteThread(deps, "thread-1");

    expect(threads).toEqual([]);
    expect(deps.removeThreadRequestState).toHaveBeenCalledWith("thread-1");
    expect(deps.clearActiveThreadState).toHaveBeenCalledTimes(1);
    expect(deps.applyThreadState).not.toHaveBeenCalled();
    expect(deps.loadThreads).not.toHaveBeenCalled();
    expect(deps.endThreadOperation).toHaveBeenCalledWith("deleting");
  });

  it("switches to another active thread when removing an unsaved active thread", async () => {
    const nextThread = createThread({ id: "thread-2", name: "Thread 2" });
    let threads = [createThread(), nextThread];
    const deps = createDependencies({
      readThreads: () => threads,
      updateThreadsState: vi.fn((updater) => {
        threads = updater(threads);
        return threads;
      }),
      hasSavedThreadSignature: vi.fn((threadId: string) => threadId === "thread-2"),
      readActiveThreadId: () => "thread-1",
    });

    await deleteThread(deps, "thread-1");

    expect(threads).toEqual([nextThread]);
    expect(deps.applyThreadState).toHaveBeenCalledWith(nextThread);
    expect(deps.clearActiveThreadState).not.toHaveBeenCalled();
  });

  it("switches to another active thread after archiving a persisted active thread", async () => {
    const activeThread = createThread();
    const nextThread = createThread({ id: "thread-2", name: "Thread 2" });
    let threads = [activeThread, nextThread];
    vi.mocked(threadsApiClient.deleteThread).mockResolvedValue({
      thread: createThreadResource({
        deletedAt: "2026-03-10T12:00:00.000Z",
      }),
    });
    const deps = createDependencies({
      readThreads: () => threads,
      hasSavedThreadSignature: vi.fn().mockReturnValue(true),
      readActiveThreadId: () => "thread-1",
      loadThreads: vi.fn().mockImplementation(async () => {
        threads = [nextThread, createThread({ id: "thread-1", deletedAt: "2026-03-10T12:00:00.000Z" })];
      }),
    });

    await deleteThread(deps, "thread-1");

    expect(deps.loadThreads).toHaveBeenCalled();
    expect(deps.applyThreadState).toHaveBeenCalledWith(nextThread);
    expect(deps.clearActiveThreadState).not.toHaveBeenCalled();
  });

  it("clears active state after archiving the last persisted active thread", async () => {
    let threads = [createThread()];
    vi.mocked(threadsApiClient.deleteThread).mockResolvedValue({
      thread: createThreadResource({
        deletedAt: "2026-03-10T12:00:00.000Z",
      }),
    });
    const deps = createDependencies({
      readThreads: () => threads,
      hasSavedThreadSignature: vi.fn().mockReturnValue(true),
      readActiveThreadId: () => "thread-1",
      loadThreads: vi.fn().mockImplementation(async () => {
        threads = [createThread({ id: "thread-1", deletedAt: "2026-03-10T12:00:00.000Z" })];
      }),
    });

    await deleteThread(deps, "thread-1");

    expect(deps.loadThreads).toHaveBeenCalled();
    expect(deps.clearActiveThreadState).toHaveBeenCalledTimes(1);
    expect(deps.applyThreadState).not.toHaveBeenCalled();
  });

  it("records a notice when in-progress processing is canceled", () => {
    const deps = createDependencies({
      cancelThreadInProgressProcessing: vi.fn().mockReturnValue(true),
    });

    cancelThreadProcessing(deps, "thread-1");

    expect(deps.setSystemNotice).toHaveBeenCalledWith(
      "Canceled in-progress processing for thread Thread 1.",
    );
    expect(deps.logClientInfo).toHaveBeenCalledWith(
      "cancel_thread_processing_succeeded",
      "Thread processing canceled.",
      expect.objectContaining({
        context: expect.objectContaining({
          threadId: "thread-1",
        }),
      }),
    );
  });
});
