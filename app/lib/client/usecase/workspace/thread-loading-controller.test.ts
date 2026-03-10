import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ThreadState } from "~/lib/contracts/threads/types";

vi.mock("~/lib/client/usecase/workspace/thread-loading-operations", () => ({
  loadThreads: vi.fn(async () => {}),
}));

import {
  loadThreads as loadThreadsOperation,
} from "~/lib/client/usecase/workspace/thread-loading-operations";
import {
  createThreadLoadingController,
} from "~/lib/client/usecase/workspace/thread-loading-controller";

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

describe("createThreadLoadingController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("assembles thread loading deps around the current refs", async () => {
    const beginLoadingThreadOperation = vi.fn(() => true);
    const endLoadingThreadOperation = vi.fn();
    const activeWorkspaceUserKeyRef = { current: "tenant::principal" };
    const activeThreadIdRef = { current: "thread-9" };
    const threadLoadRequestSeqRef = { current: 0 };
    const isThreadsReadyRef = { current: false };

    const controller = createThreadLoadingController({
      activeWorkspaceUserKeyRef,
      activeThreadIdRef,
      threadLoadRequestSeqRef,
      isThreadsReadyRef,
      clearThreadsState: vi.fn(),
      beginLoadingThreadOperation,
      endLoadingThreadOperation,
      setThreadError: vi.fn(),
      loadThreads: vi.fn(async () => ({ threads: [] })),
      markAzureAuthRequired: vi.fn(),
      setThreadSaveSignatures: vi.fn(),
      setThreadsState: vi.fn(),
      pruneThreadRequestState: vi.fn(),
      applyThreadState: vi.fn(),
      createLocalThreadState: () => createThreadState(),
      logClientInfo: vi.fn(),
      logClientError: vi.fn(),
    });

    await controller.loadThreads();

    expect(loadThreadsOperation).toHaveBeenCalledTimes(1);
    const deps = vi.mocked(loadThreadsOperation).mock.calls[0]?.[0];
    expect(deps?.readActiveWorkspaceUserKey()).toBe("tenant::principal");
    expect(deps?.nextThreadLoadRequestSeq()).toBe(1);
    expect(deps?.readThreadLoadRequestSeq()).toBe(1);
    expect(threadLoadRequestSeqRef.current).toBe(1);
    expect(deps?.beginThreadOperation()).toBe(true);
    expect(beginLoadingThreadOperation).toHaveBeenCalledTimes(1);
    deps?.setThreadsReady();
    expect(isThreadsReadyRef.current).toBe(true);
    expect(deps?.readPreferredThreadId()).toBe("thread-9");
    deps?.endThreadOperation();
    expect(endLoadingThreadOperation).toHaveBeenCalledTimes(1);
  });
});
