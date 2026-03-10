import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ThreadState } from "~/lib/client/usecase/workspace/threads/thread-state";

vi.mock("~/lib/client/usecase/workspace/threads/thread-persistence-operations", () => ({
  flushActiveThreadState: vi.fn(async () => true),
  saveActiveThreadNameInBackground: vi.fn(async () => {}),
  saveThreadStateSilentlyIfNeeded: vi.fn(async () => {}),
  saveThreadStateToDatabase: vi.fn(async () => true),
}));

import {
  flushActiveThreadState,
  saveActiveThreadNameInBackground,
  saveThreadStateSilentlyIfNeeded,
  saveThreadStateToDatabase,
} from "~/lib/client/usecase/workspace/threads/thread-persistence-operations";
import {
  createThreadPersistenceController,
} from "~/lib/client/usecase/workspace/threads/thread-persistence-controller";

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

describe("createThreadPersistenceController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("assembles persistence deps around the latest readers", async () => {
    const thread = createThreadState();
    let activeWorkspaceUserKey = "tenant::principal";
    let activeThreadId = "thread-1";
    let latestThreads = [thread];
    const threadSaveSignatures = new Map<string, string>();
    let threadSaveRequestSeq = 0;

    const controller = createThreadPersistenceController({
      readActiveWorkspaceUserKey: () => activeWorkspaceUserKey,
      readActiveThreadId: () => activeThreadId,
      readThreads: () => latestThreads,
      readSavedThreadSignature: (threadId) => threadSaveSignatures.get(threadId),
      writeThreadSaveSignature: (threadId, signature) => {
        threadSaveSignatures.set(threadId, signature);
      },
      nextThreadSaveRequestSeq: () => {
        threadSaveRequestSeq += 1;
        return threadSaveRequestSeq;
      },
      readThreadSaveRequestSeq: () => threadSaveRequestSeq,
      setIsSavingThread: vi.fn(),
      markAzureAuthRequired: vi.fn(),
      setThreadError: vi.fn(),
      updateThreadsState: vi.fn((updater: (current: ThreadState[]) => ThreadState[]) =>
        updater(latestThreads),
      ),
      setActiveThreadNameInput: vi.fn(),
      buildThreadStateFromCurrentState: vi.fn((base: ThreadState) => base),
      clearThreadNameSaveTimeout: vi.fn(),
      clearThreadSaveTimeout: vi.fn(),
      saveThread: vi.fn(async () => ({ threads: [], thread: undefined })),
      logClientInfo: vi.fn(),
      logClientError: vi.fn(),
    });

    activeWorkspaceUserKey = "tenant::next-principal";
    activeThreadId = "thread-2";
    latestThreads = [thread, createThreadState({ id: "thread-2", name: "Thread 2" })];

    await controller.saveThreadStateToDatabase(thread);
    expect(saveThreadStateToDatabase).toHaveBeenCalledTimes(1);
    const persistenceDeps = vi.mocked(saveThreadStateToDatabase).mock.calls[0]?.[0];
    expect(persistenceDeps?.readActiveWorkspaceUserKey()).toBe("tenant::next-principal");
    expect(persistenceDeps?.readActiveThreadId()).toBe("thread-2");
    expect(persistenceDeps?.readThreads()).toEqual(latestThreads);
    persistenceDeps?.writeThreadSaveSignature("thread-1", "signature-1");
    expect(
      persistenceDeps?.readSavedThreadSignature("thread-1"),
    ).toBe("signature-1");
    expect(persistenceDeps?.nextThreadSaveRequestSeq()).toBe(1);
    expect(persistenceDeps?.readThreadSaveRequestSeq()).toBe(1);
    expect(threadSaveRequestSeq).toBe(1);

    await controller.saveThreadStateSilentlyIfNeeded("thread-1");
    expect(saveThreadStateSilentlyIfNeeded).toHaveBeenCalledTimes(1);

    await controller.flushActiveThreadState();
    expect(flushActiveThreadState).toHaveBeenCalledTimes(1);

    await controller.saveActiveThreadNameInBackground("thread-1", "Renamed");
    expect(saveActiveThreadNameInBackground).toHaveBeenCalledTimes(1);
  });
});
