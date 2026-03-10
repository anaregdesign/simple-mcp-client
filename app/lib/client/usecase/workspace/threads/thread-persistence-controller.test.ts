import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ThreadState } from "~/lib/contracts/threads/types";

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

  it("assembles persistence deps around the current refs", async () => {
    const thread = createThreadState();
    const activeWorkspaceUserKeyRef = { current: "tenant::principal" };
    const activeThreadIdRef = { current: "thread-1" };
    const threadsRef = { current: [thread] };
    const threadSaveSignatureByIdRef = {
      current: new Map<string, string>(),
    };
    const threadSaveRequestSeqRef = { current: 0 };

    const controller = createThreadPersistenceController({
      activeWorkspaceUserKeyRef,
      activeThreadIdRef,
      threadsRef,
      threadSaveSignatureByIdRef,
      threadSaveRequestSeqRef,
      setIsSavingThread: vi.fn(),
      markAzureAuthRequired: vi.fn(),
      setThreadError: vi.fn(),
      updateThreadsState: vi.fn((updater: (current: ThreadState[]) => ThreadState[]) =>
        updater(threadsRef.current),
      ),
      setActiveThreadNameInput: vi.fn(),
      shouldPersistThreadState: vi.fn(() => true),
      buildThreadStateFromCurrentState: vi.fn((base: ThreadState) => base),
      clearThreadNameSaveTimeout: vi.fn(),
      clearThreadSaveTimeout: vi.fn(),
      saveThread: vi.fn(async () => ({ threads: [], thread: undefined })),
      logClientInfo: vi.fn(),
      logClientError: vi.fn(),
    });

    await controller.saveThreadStateToDatabase(thread, "signature-1");
    expect(saveThreadStateToDatabase).toHaveBeenCalledTimes(1);
    const persistenceDeps = vi.mocked(saveThreadStateToDatabase).mock.calls[0]?.[0];
    expect(persistenceDeps?.readActiveWorkspaceUserKey()).toBe("tenant::principal");
    expect(persistenceDeps?.readThreads()).toEqual([thread]);
    expect(persistenceDeps?.hasSavedThreadSignature("thread-1")).toBe(false);
    persistenceDeps?.writeThreadSaveSignature("thread-1", "signature-1");
    expect(
      persistenceDeps?.readSavedThreadSignature("thread-1"),
    ).toBe("signature-1");
    expect(persistenceDeps?.nextThreadSaveRequestSeq()).toBe(1);
    expect(threadSaveRequestSeqRef.current).toBe(1);

    await controller.saveThreadStateSilentlyIfNeeded("thread-1");
    expect(saveThreadStateSilentlyIfNeeded).toHaveBeenCalledTimes(1);

    await controller.flushActiveThreadState();
    expect(flushActiveThreadState).toHaveBeenCalledTimes(1);

    await controller.saveActiveThreadNameInBackground("thread-1", "Renamed");
    expect(saveActiveThreadNameInBackground).toHaveBeenCalledTimes(1);
  });
});
