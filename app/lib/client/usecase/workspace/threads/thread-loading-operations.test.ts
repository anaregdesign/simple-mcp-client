import { describe, expect, it, vi } from "vitest";
import { ClientApiError } from "~/lib/client/infrastructure/api/api-client";
import type {
  ThreadResource,
} from "~/lib/contracts/threads/types";
import type { ThreadState } from "~/lib/client/usecase/workspace/threads/thread-state";
import { loadThreads } from "./thread-loading-operations";

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

function createThreadResource(state: ThreadState): ThreadResource {
  return {
    id: state.id,
    userId: 1,
    name: state.name,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
    deletedAt: state.deletedAt,
    reasoningEffort: state.reasoningEffort,
    webSearchEnabled: state.webSearchEnabled,
    threadEnvironmentJson: JSON.stringify(state.threadEnvironment),
    instructionContextTogglesJson: JSON.stringify(
      state.instructionContextToggles,
    ),
    instruction: {
      id: 1,
      threadId: state.id,
      content: state.agentInstruction,
    },
    messages: [],
    mcpServers: [],
    mcpRpcLogs: [],
    skillSelections: [],
  };
}

function createDependencies(
  overrides: {
    loadThreads?: (options: {
      onAuthRequired?: () => void;
    }) => Promise<{ threads?: ThreadResource[] }>;
  } = {},
) {
  const state = {
    activeWorkspaceUserKey: "tenant::principal",
    threadLoadRequestSeq: 0,
    threadError: null as string | null,
    savedSignatures: [] as string[],
    threads: [] as ThreadState[],
    prunedThreadIds: [] as string[],
    threadsReady: false,
    preferredThreadId: "thread-2",
    appliedThreadId: null as string | null,
    clearedThreadsError: null as string | null | undefined,
    authRequiredCount: 0,
    beginCount: 0,
    endCount: 0,
    infoEvents: [] as string[],
    errorEvents: [] as string[],
  };

  const deps = {
    readActiveWorkspaceUserKey: () => state.activeWorkspaceUserKey,
    clearThreadsState: (nextError?: string | null) => {
      state.clearedThreadsError = nextError;
      state.threads = [];
    },
    nextThreadLoadRequestSeq: () => {
      state.threadLoadRequestSeq += 1;
      return state.threadLoadRequestSeq;
    },
    readThreadLoadRequestSeq: () => state.threadLoadRequestSeq,
    beginThreadOperation: () => {
      state.beginCount += 1;
      return true;
    },
    endThreadOperation: () => {
      state.endCount += 1;
    },
    setThreadError: (value: string | null) => {
      state.threadError = value;
    },
    loadThreads:
      overrides.loadThreads ??
      vi.fn(async () => ({
        threads: [
          createThreadResource(
            createThreadState({
              id: "thread-1",
              name: "First",
            }),
          ),
          createThreadResource(
            createThreadState({
              id: "thread-2",
              name: "Second",
              updatedAt: "2026-01-02T00:00:00.000Z",
            }),
          ),
        ],
      })),
    markAzureAuthRequired: () => {
      state.authRequiredCount += 1;
    },
    setThreadSaveSignatures: (threads: ThreadState[]) => {
      state.savedSignatures = threads.map((thread) => thread.id);
    },
    setThreadsState: (threads: ThreadState[]) => {
      state.threads = threads;
    },
    pruneThreadRequestState: (validThreadIds: string[]) => {
      state.prunedThreadIds = validThreadIds;
    },
    setThreadsReady: () => {
      state.threadsReady = true;
    },
    readPreferredThreadId: () => state.preferredThreadId,
    applyThreadState: (thread: ThreadState) => {
      state.appliedThreadId = thread.id;
    },
    createLocalThreadState: () =>
      createThreadState({
        id: "local-thread",
        name: "Local Thread",
      }),
    logClientInfo: (eventName: string) => {
      state.infoEvents.push(eventName);
    },
    logClientError: (eventName: string) => {
      state.errorEvents.push(eventName);
    },
  };

  return { deps, state };
}

describe("thread-loading-operations", () => {
  it("loads threads and applies the preferred thread", async () => {
    const { deps, state } = createDependencies();

    await loadThreads(deps);

    expect(state.savedSignatures).toEqual(["thread-1", "thread-2"]);
    expect(state.prunedThreadIds).toEqual(["thread-1", "thread-2"]);
    expect(state.threads.map((thread) => thread.id)).toEqual([
      "thread-1",
      "thread-2",
    ]);
    expect(state.appliedThreadId).toBe("thread-2");
    expect(state.threadsReady).toBe(true);
    expect(state.infoEvents).toEqual(["load_threads_succeeded"]);
    expect(state.endCount).toBe(1);
  });

  it("creates a local placeholder thread when all loaded threads are archived", async () => {
    const { deps, state } = createDependencies({
      loadThreads: vi.fn(async () => ({
        threads: [
          createThreadResource(
            createThreadState({
              id: "archived-thread",
              deletedAt: "2026-01-03T00:00:00.000Z",
            }),
          ),
        ],
      })),
    });

    await loadThreads(deps);

    expect(state.threads.map((thread) => thread.id)).toEqual([
      "local-thread",
      "archived-thread",
    ]);
    expect(state.appliedThreadId).toBe("local-thread");
  });

  it("handles auth_required without logging a failure", async () => {
    const loadThreadsMock = vi.fn(async (options: {
      onAuthRequired?: () => void;
    }) => {
      options.onAuthRequired?.();
      throw new ClientApiError({
        kind: "auth_required",
        status: 401,
        message: "Azure login is required.",
      });
    });
    const { deps, state } = createDependencies({
      loadThreads: loadThreadsMock,
    });

    await loadThreads(deps);

    expect(state.authRequiredCount).toBe(1);
    expect(state.clearedThreadsError).toBe(
      "Azure login is required. Open Settings and sign in to load threads.",
    );
    expect(state.errorEvents).toEqual([]);
    expect(state.endCount).toBe(1);
  });
});
