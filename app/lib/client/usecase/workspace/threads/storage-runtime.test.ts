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
  });

  it("owns thread api wiring and delegates controller methods", async () => {
    const thread = createThreadState();
    const runtime = createThreadStorageRuntime({
      persistence: {
        activeWorkspaceUserKeyRef: { current: "tenant::principal" },
        activeThreadIdRef: { current: "thread-1" },
        threadsRef: { current: [] as ThreadState[] },
        threadSaveSignatureByIdRef: { current: new Map<string, string>() },
        threadSaveRequestSeqRef: { current: 0 },
        setIsSavingThread: vi.fn(),
        markAzureAuthRequired: vi.fn(),
        setThreadError: vi.fn(),
        updateThreadsState: vi.fn((updater: (current: ThreadState[]) => ThreadState[]) =>
          updater([]),
        ),
        setActiveThreadNameInput: vi.fn(),
        shouldPersistThreadState: vi.fn(() => true),
        buildThreadStateFromCurrentState: vi.fn((thread) => thread),
        clearThreadNameSaveTimeout: vi.fn(),
        clearThreadSaveTimeout: vi.fn(),
        logClientInfo: vi.fn(),
        logClientError: vi.fn(),
      },
      loading: {
        activeWorkspaceUserKeyRef: { current: "tenant::principal" },
        activeThreadIdRef: { current: "thread-1" },
        threadLoadRequestSeqRef: { current: 0 },
        isThreadsReadyRef: { current: false },
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

    await runtime.saveThreadStateToDatabase(
      thread,
      "signature-1",
    );
    await runtime.saveThreadStateSilentlyIfNeeded("thread-1");
    await runtime.flushActiveThreadState();
    await runtime.saveActiveThreadNameInBackground("thread-1", "Renamed");
    await runtime.loadThreads();

    expect(mockPersistenceController.saveThreadStateToDatabase).toHaveBeenCalledWith(
      thread,
      "signature-1",
      {},
    );
    expect(mockPersistenceController.saveThreadStateSilentlyIfNeeded).toHaveBeenCalledWith(
      "thread-1",
    );
    expect(mockPersistenceController.flushActiveThreadState).toHaveBeenCalledTimes(1);
    expect(
      mockPersistenceController.saveActiveThreadNameInBackground,
    ).toHaveBeenCalledWith("thread-1", "Renamed");
    expect(mockLoadingController.loadThreads).toHaveBeenCalledTimes(1);
  });
});
