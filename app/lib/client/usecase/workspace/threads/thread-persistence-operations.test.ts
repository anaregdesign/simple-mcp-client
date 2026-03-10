import { describe, expect, it, vi } from "vitest";
import { ClientApiError } from "~/lib/client/infrastructure/api/api-client";
import { buildThreadSaveSignature } from "~/lib/client/usecase/workspace/threads/thread-state";
import type {
  ThreadResource,
  ThreadWritePayload,
} from "~/lib/contracts/threads/types";
import type { ThreadState } from "~/lib/client/usecase/workspace/threads/thread-state";
import {
  flushActiveThreadState,
  saveThreadStateSilentlyIfNeeded,
  saveThreadStateToDatabase,
} from "./thread-persistence-operations";

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

function createDependencies(overrides: {
  saveThread?: (
    payload: ThreadWritePayload,
    options: {
      isUpdate?: boolean;
      onAuthRequired?: () => void;
    },
  ) => Promise<{
    thread?: ThreadResource;
  }>;
} = {}) {
  const baseThread = createThreadState();
  const state = {
    activeWorkspaceUserKey: "tenant::principal",
    activeThreadId: baseThread.id,
    threads: [baseThread] as ThreadState[],
    signatures: new Map<string, string>(),
    threadSaveRequestSeq: 0,
    isSavingThread: false,
    threadError: null as string | null,
    activeThreadNameInput: "",
    authRequiredCount: 0,
    clearedThreadNameSaveTimeoutCount: 0,
    clearedThreadSaveTimeoutCount: 0,
    infoEvents: [] as string[],
    errorEvents: [] as string[],
  };

  const deps = {
    readActiveWorkspaceUserKey: () => state.activeWorkspaceUserKey,
    readActiveThreadId: () => state.activeThreadId,
    readThreads: () => state.threads,
    hasSavedThreadSignature: (threadId: string) => state.signatures.has(threadId),
    readSavedThreadSignature: (threadId: string) => state.signatures.get(threadId),
    writeThreadSaveSignature: (threadId: string, signature: string) => {
      state.signatures.set(threadId, signature);
    },
    nextThreadSaveRequestSeq: () => {
      state.threadSaveRequestSeq += 1;
      return state.threadSaveRequestSeq;
    },
    readThreadSaveRequestSeq: () => state.threadSaveRequestSeq,
    setIsSavingThread: (value: boolean) => {
      state.isSavingThread = value;
    },
    markAzureAuthRequired: () => {
      state.authRequiredCount += 1;
    },
    setThreadError: (value: string | null) => {
      state.threadError = value;
    },
    updateThreadsState: (
      updater: (current: ThreadState[]) => ThreadState[],
    ): ThreadState[] => {
      state.threads = updater(state.threads);
      return state.threads;
    },
    setActiveThreadNameInput: (value: string) => {
      state.activeThreadNameInput = value;
    },
    shouldPersistThreadState: () => true,
    buildThreadStateFromCurrentState: (
      base: ThreadState,
      options?: {
        includeDraftName?: boolean;
      },
    ) => ({
      ...base,
      updatedAt: "2026-01-02T00:00:00.000Z",
      name:
        options?.includeDraftName && state.activeThreadNameInput.trim()
          ? state.activeThreadNameInput.trim()
          : base.name,
    }),
    clearThreadNameSaveTimeout: () => {
      state.clearedThreadNameSaveTimeoutCount += 1;
    },
    clearThreadSaveTimeout: () => {
      state.clearedThreadSaveTimeoutCount += 1;
    },
    saveThread:
      overrides.saveThread ??
      vi.fn(async (payload: ThreadWritePayload) => {
        const savedState = createThreadState({
          ...baseThread,
          id: payload.id,
          name: payload.name,
          createdAt: payload.createdAt,
          agentInstruction: payload.instruction.content,
        });
        return {
          thread: createThreadResource(savedState),
        };
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

describe("thread-persistence-operations", () => {
  it("saves a thread snapshot and updates the active thread name", async () => {
    const savedThread = createThreadState({
      name: "Saved Thread",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
    const saveThread = vi.fn(async () => ({
      thread: createThreadResource(savedThread),
    }));
    const { deps, state } = createDependencies({
      saveThread,
    });

    const result = await saveThreadStateToDatabase(
      deps,
      state.threads[0]!,
      "signature-1",
    );

    expect(result).toBe(true);
    expect(saveThread).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "thread-1",
      }),
      expect.objectContaining({
        isUpdate: false,
      }),
    );
    expect(state.threads[0]?.name).toBe("Saved Thread");
    expect(state.signatures.get("thread-1")).toBe("signature-1");
    expect(state.activeThreadNameInput).toBe("Saved Thread");
    expect(state.infoEvents).toEqual(["save_thread_snapshot_succeeded"]);
    expect(state.isSavingThread).toBe(false);
  });

  it("reports auth_required errors without logging a failure", async () => {
    const saveThread = vi.fn(
      async (
        _payload: ThreadWritePayload,
        options: {
          isUpdate?: boolean;
          onAuthRequired?: () => void;
        },
      ) => {
        options.onAuthRequired?.();
        throw new ClientApiError({
          kind: "auth_required",
          message: "Azure login is required.",
          status: 401,
        });
      },
    );
    const { deps, state } = createDependencies({
      saveThread,
    });

    const result = await saveThreadStateToDatabase(
      deps,
      state.threads[0]!,
      "signature-1",
    );

    expect(result).toBe(false);
    expect(state.authRequiredCount).toBe(1);
    expect(state.threadError).toBe(
      "Azure login is required. Open Settings and sign in to continue.",
    );
    expect(state.errorEvents).toEqual([]);
    expect(state.isSavingThread).toBe(false);
  });

  it("skips silent saves when the signature is unchanged", async () => {
    const saveThread = vi.fn();
    const { deps, state } = createDependencies({
      saveThread,
    });
    const signature = buildThreadSaveSignature(state.threads[0]!);
    state.signatures.set("thread-1", signature);

    await saveThreadStateSilentlyIfNeeded(deps, "thread-1");

    expect(saveThread).not.toHaveBeenCalled();
  });

  it("flushes the active thread state after clearing pending timeouts", async () => {
    const saveThread = vi.fn(async () => ({
      thread: createThreadResource(
        createThreadState({
          name: "Renamed Thread",
          updatedAt: "2026-01-02T00:00:00.000Z",
        }),
      ),
    }));
    const { deps, state } = createDependencies({
      saveThread,
    });
    state.activeThreadNameInput = "Renamed Thread";

    const result = await flushActiveThreadState(deps);

    expect(result).toBe(true);
    expect(state.clearedThreadNameSaveTimeoutCount).toBe(1);
    expect(state.clearedThreadSaveTimeoutCount).toBe(1);
    expect(saveThread).toHaveBeenCalledOnce();
  });
});
