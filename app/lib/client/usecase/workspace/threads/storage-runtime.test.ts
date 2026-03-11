import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ThreadWritePayload } from "~/lib/contracts/threads/types";
import type { ThreadState } from "~/lib/client/usecase/workspace/threads/thread-state";

const mockPersistenceController = {
  saveThreadStateToDatabase: vi.fn(async () => true),
  saveThreadStateSilentlyIfNeeded: vi.fn(async () => {}),
  flushActiveThreadState: vi.fn(async () => true),
  saveActiveThreadNameInBackground: vi.fn(async () => {}),
};

const mockLoadingController = {
  loadThreads: vi.fn(async () => {}),
};

vi.mock("~/lib/client/usecase/workspace/threads/thread-persistence-controller", () => ({
  createThreadPersistenceController: vi.fn(() => mockPersistenceController),
}));

vi.mock("~/lib/client/usecase/workspace/threads/thread-loading-controller", () => ({
  createThreadLoadingController: vi.fn(() => mockLoadingController),
}));

vi.mock("~/lib/client/infrastructure/api/threads-api-client", () => ({
  threadsApiClient: {
    saveThread: vi.fn(async () => ({ threads: [] })),
    loadThreads: vi.fn(async () => ({ threads: [] })),
  },
}));

import {
  threadsApiClient,
} from "~/lib/client/infrastructure/api/threads-api-client";
import {
  createThreadLoadingController,
} from "~/lib/client/usecase/workspace/threads/thread-loading-controller";
import {
  createThreadPersistenceController,
} from "~/lib/client/usecase/workspace/threads/thread-persistence-controller";
import {
  createThreadStorageRuntime,
} from "~/lib/client/usecase/workspace/threads/storage-runtime";

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

describe("createThreadStorageRuntime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("owns thread api wiring and delegates controller methods", async () => {
    const thread = createThreadState();
    const runtime = createThreadStorageRuntime({
      persistence: {
        readActiveWorkspaceUserKey: vi.fn(() => "tenant::principal"),
        readActiveThreadId: vi.fn(() => "thread-1"),
        readThreads: vi.fn(() => [] as ThreadState[]),
        readSavedThreadSignature: vi.fn(),
        writeThreadSaveSignature: vi.fn(),
        nextThreadSaveRequestSeq: vi.fn(() => 1),
        readThreadSaveRequestSeq: vi.fn(() => 1),
        setIsSavingThread: vi.fn(),
        markAzureAuthRequired: vi.fn(),
        setThreadError: vi.fn(),
        updateThreadsState: vi.fn((updater: (current: ThreadState[]) => ThreadState[]) =>
          updater([]),
        ),
        setActiveThreadNameInput: vi.fn(),
        buildThreadStateFromCurrentState: vi.fn((thread) => thread),
        clearThreadNameSaveTimeout: vi.fn(),
        clearThreadSaveTimeout: vi.fn(),
        logClientInfo: vi.fn(),
        logClientError: vi.fn(),
      },
      loading: {
        readActiveWorkspaceUserKey: vi.fn(() => "tenant::principal"),
        readPreferredThreadId: vi.fn(() => "thread-1"),
        nextThreadLoadRequestSeq: vi.fn(() => 1),
        readThreadLoadRequestSeq: vi.fn(() => 1),
        setThreadsReady: vi.fn(),
        clearThreadsState: vi.fn(),
        beginLoadingThreadOperation: vi.fn(() => true),
        endLoadingThreadOperation: vi.fn(),
        setThreadError: vi.fn(),
        markAzureAuthRequired: vi.fn(),
        setThreadSaveSignatures: vi.fn(),
        setThreadsState: vi.fn(),
        pruneThreadRequestState: vi.fn(),
        applyThreadState: vi.fn(),
        createLocalThreadState: vi.fn(() => createThreadState()),
        logClientInfo: vi.fn(),
        logClientError: vi.fn(),
      },
    });

    const threadPayload = { id: "thread-1", name: "Thread 1" } as ThreadWritePayload;
    const persistenceOptions = vi
      .mocked(createThreadPersistenceController)
      .mock.calls[0]?.[0];
    await persistenceOptions?.saveThread(threadPayload, {
      isUpdate: true,
      onAuthRequired: vi.fn(),
    });
    expect(threadsApiClient.saveThread).toHaveBeenCalledWith(threadPayload, {
      isUpdate: true,
      onAuthRequired: expect.any(Function),
    });

    const loadingOptions = vi
      .mocked(createThreadLoadingController)
      .mock.calls[0]?.[0];
    await loadingOptions?.loadThreads({
      onAuthRequired: vi.fn(),
    });
    expect(threadsApiClient.loadThreads).toHaveBeenCalledWith({
      onAuthRequired: expect.any(Function),
    });

    await runtime.saveThreadStateToDatabase(thread);
    await runtime.saveThreadStateSilentlyIfNeeded("thread-1");
    runtime.scheduleThreadStateSave("thread-2");
    await runtime.flushActiveThreadState();
    await runtime.saveActiveThreadNameInBackground("thread-1", "Renamed");
    await runtime.loadThreads();

    expect(mockPersistenceController.saveThreadStateToDatabase).toHaveBeenCalledWith(
      thread,
      {},
    );
    expect(mockPersistenceController.saveThreadStateSilentlyIfNeeded).toHaveBeenCalledWith(
      "thread-1",
    );
    expect(mockPersistenceController.saveThreadStateSilentlyIfNeeded).toHaveBeenCalledWith(
      "thread-2",
    );
    expect(mockPersistenceController.flushActiveThreadState).toHaveBeenCalledTimes(1);
    expect(
      mockPersistenceController.saveActiveThreadNameInBackground,
    ).toHaveBeenCalledWith("thread-1", "Renamed");
    expect(mockLoadingController.loadThreads).toHaveBeenCalledTimes(1);
  });

  it("schedules thread save through queueMicrotask", () => {
    const queueMicrotaskMock = vi.fn((callback: () => void) => {
      callback();
    });
    vi.stubGlobal("queueMicrotask", queueMicrotaskMock);

    const runtime = createThreadStorageRuntime({
      persistence: {
        readActiveWorkspaceUserKey: vi.fn(() => "tenant::principal"),
        readActiveThreadId: vi.fn(() => "thread-1"),
        readThreads: vi.fn(() => [] as ThreadState[]),
        readSavedThreadSignature: vi.fn(),
        writeThreadSaveSignature: vi.fn(),
        nextThreadSaveRequestSeq: vi.fn(() => 1),
        readThreadSaveRequestSeq: vi.fn(() => 1),
        setIsSavingThread: vi.fn(),
        markAzureAuthRequired: vi.fn(),
        setThreadError: vi.fn(),
        updateThreadsState: vi.fn((updater: (current: ThreadState[]) => ThreadState[]) =>
          updater([]),
        ),
        setActiveThreadNameInput: vi.fn(),
        buildThreadStateFromCurrentState: vi.fn((thread) => thread),
        clearThreadNameSaveTimeout: vi.fn(),
        clearThreadSaveTimeout: vi.fn(),
        logClientInfo: vi.fn(),
        logClientError: vi.fn(),
      },
      loading: {
        readActiveWorkspaceUserKey: vi.fn(() => "tenant::principal"),
        readPreferredThreadId: vi.fn(() => "thread-1"),
        nextThreadLoadRequestSeq: vi.fn(() => 1),
        readThreadLoadRequestSeq: vi.fn(() => 1),
        setThreadsReady: vi.fn(),
        clearThreadsState: vi.fn(),
        beginLoadingThreadOperation: vi.fn(() => true),
        endLoadingThreadOperation: vi.fn(),
        setThreadError: vi.fn(),
        markAzureAuthRequired: vi.fn(),
        setThreadSaveSignatures: vi.fn(),
        setThreadsState: vi.fn(),
        pruneThreadRequestState: vi.fn(),
        applyThreadState: vi.fn(),
        createLocalThreadState: vi.fn(() => createThreadState()),
        logClientInfo: vi.fn(),
        logClientError: vi.fn(),
      },
    });

    runtime.scheduleThreadStateSave("thread-3");

    expect(queueMicrotaskMock).toHaveBeenCalledTimes(1);
    expect(mockPersistenceController.saveThreadStateSilentlyIfNeeded).toHaveBeenCalledWith(
      "thread-3",
    );
  });
});
