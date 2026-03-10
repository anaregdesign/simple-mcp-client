import { ClientApiError, mapApiError } from "~/lib/client/infrastructure/api/api-client";
import type { ThreadsApiResponse } from "~/lib/client/infrastructure/api/threads-api-client";
import { DEFAULT_AGENT_INSTRUCTION } from "~/lib/domain/value-objects/thread-defaults";
import { THREAD_NAME_MAX_LENGTH } from "~/lib/constants/client";
import {
  convertThreadResourceToState,
  convertThreadStateToWritePayload,
} from "~/lib/client/usecase/workspace/threads/thread-state-mappers";
import {
  buildThreadPersistencePlan,
  buildThreadPersistencePlanFromCurrentState,
} from "~/lib/client/usecase/workspace/threads/thread-persistence-plan";
import {
  type ThreadState,
  upsertThreadState,
} from "~/lib/client/usecase/workspace/threads/thread-state";
import { readThreadResourceFromUnknown } from "~/lib/contracts/threads/parsers";
import type { ThreadWritePayload } from "~/lib/contracts/threads/types";
import { findThreadStateById } from "~/lib/client/usecase/workspace/threads/thread-runtime";

type ThreadPersistenceLogOptions = {
  category?: string;
  location?: string;
  action?: string;
  statusCode?: number;
  context?: Record<string, unknown>;
};

type ThreadPersistenceDependencies = {
  readActiveWorkspaceUserKey: () => string;
  readActiveThreadId: () => string;
  readThreads: () => ThreadState[];
  readSavedThreadSignature: (threadId: string) => string | undefined;
  writeThreadSaveSignature: (threadId: string, signature: string) => void;
  nextThreadSaveRequestSeq: () => number;
  readThreadSaveRequestSeq: () => number;
  setIsSavingThread: (value: boolean) => void;
  markAzureAuthRequired: () => void;
  setThreadError: (value: string | null) => void;
  updateThreadsState: (
    updater: (current: ThreadState[]) => ThreadState[],
  ) => ThreadState[];
  setActiveThreadNameInput: (value: string) => void;
  buildThreadStateFromCurrentState: (
    base: ThreadState,
    options?: {
      includeDraftName?: boolean;
    },
  ) => ThreadState;
  clearThreadNameSaveTimeout: () => void;
  clearThreadSaveTimeout: () => void;
  saveThread: (
    payload: ThreadWritePayload,
    options: {
      isUpdate?: boolean;
      onAuthRequired?: () => void;
    },
  ) => Promise<ThreadsApiResponse>;
  logClientInfo: (
    eventName: string,
    message: string,
    options?: ThreadPersistenceLogOptions,
  ) => void;
  logClientError: (
    eventName: string,
    error: unknown,
    options?: ThreadPersistenceLogOptions,
  ) => void;
};

export async function saveThreadStateToDatabase(
  deps: ThreadPersistenceDependencies,
  thread: ThreadState,
  options: {
    showBusy?: boolean;
    reportError?: boolean;
  } = {},
): Promise<boolean> {
  const showBusy = options.showBusy !== false;
  const reportError = options.reportError !== false;
  const persistencePlan = buildThreadPersistencePlan(thread, {
    readSavedThreadSignature: deps.readSavedThreadSignature,
  });
  if (!persistencePlan) {
    return true;
  }

  const expectedUserKey = deps.readActiveWorkspaceUserKey().trim();
  if (!expectedUserKey) {
    return false;
  }

  const expectedThreadId = persistencePlan.snapshot.id;
  const hasPersistedSignature = persistencePlan.hasSavedSignature;
  const nextSignature = persistencePlan.signature;
  const method = hasPersistedSignature ? "PUT" : "POST";
  const requestSeq = deps.nextThreadSaveRequestSeq();
  if (showBusy) {
    deps.setIsSavingThread(true);
  }

  try {
    const payload = await deps.saveThread(
      convertThreadStateToWritePayload(persistencePlan.snapshot),
      {
        isUpdate: hasPersistedSignature,
        onAuthRequired: () => {
          deps.markAzureAuthRequired();
          if (reportError) {
            deps.setThreadError(
              "Azure login is required. Open Settings and sign in to continue.",
            );
          }
        },
      },
    );

    const savedThreadResource = readThreadResourceFromUnknown(payload.thread);
    if (!savedThreadResource) {
      throw new Error("Saved thread payload is invalid.");
    }

    const savedThread = convertThreadResourceToState(savedThreadResource, {
      fallbackInstruction: DEFAULT_AGENT_INSTRUCTION,
    });
    if (expectedUserKey !== deps.readActiveWorkspaceUserKey().trim()) {
      return false;
    }
    if (expectedThreadId !== savedThread.id) {
      return false;
    }

    deps.updateThreadsState((current) => upsertThreadState(current, savedThread));
    deps.writeThreadSaveSignature(savedThread.id, nextSignature);
    if (savedThread.id === deps.readActiveThreadId().trim()) {
      deps.setActiveThreadNameInput(savedThread.name);
    }
    deps.logClientInfo("save_thread_snapshot_succeeded", "Thread snapshot saved.", {
      action: "save_thread_snapshot",
      context: {
        method,
        threadId: savedThread.id,
        messageCount: savedThread.messages.length,
        mcpServerCount: savedThread.mcpServers.length,
        operationLogCount: savedThread.mcpRpcLogs.length,
        skillSelectionCount: savedThread.skillSelections.length,
      },
    });
    return true;
  } catch (saveError) {
    if (saveError instanceof ClientApiError && saveError.kind === "auth_required") {
      return false;
    }

    deps.logClientError("save_thread_snapshot_failed", saveError, {
      action: "save_thread_snapshot",
      statusCode: 500,
      context: {
        threadId: expectedThreadId,
      },
    });
    if (reportError) {
      deps.setThreadError(mapApiError(saveError, "Failed to save thread."));
    }
    return false;
  } finally {
    if (showBusy && requestSeq === deps.readThreadSaveRequestSeq()) {
      deps.setIsSavingThread(false);
    }
  }
}

export async function saveThreadStateSilentlyIfNeeded(
  deps: ThreadPersistenceDependencies,
  threadId: string,
): Promise<void> {
  const normalizedThreadId = threadId.trim();
  if (!normalizedThreadId) {
    return;
  }

  const snapshot = findThreadStateById(deps.readThreads(), normalizedThreadId);
  if (!snapshot) {
    return;
  }

  const persistencePlan = buildThreadPersistencePlan(snapshot, {
    readSavedThreadSignature: deps.readSavedThreadSignature,
  });
  if (!persistencePlan) {
    return;
  }

  await saveThreadStateToDatabase(
    deps,
    persistencePlan.snapshot,
    {
      showBusy: false,
      reportError: false,
    },
  );
}

export async function flushActiveThreadState(
  deps: ThreadPersistenceDependencies,
): Promise<boolean> {
  const currentThreadId = deps.readActiveThreadId().trim();
  if (!currentThreadId) {
    return true;
  }

  deps.clearThreadNameSaveTimeout();

  const baseThread = findThreadStateById(deps.readThreads(), currentThreadId);
  if (!baseThread) {
    return true;
  }

  const persistencePlan = buildThreadPersistencePlanFromCurrentState({
    baseThread,
    buildThreadStateFromCurrentState: deps.buildThreadStateFromCurrentState,
    readSavedThreadSignature: deps.readSavedThreadSignature,
    includeDraftName: true,
  });
  if (!persistencePlan) {
    return true;
  }

  deps.clearThreadSaveTimeout();
  return await saveThreadStateToDatabase(
    deps,
    persistencePlan.snapshot,
  );
}

export async function saveActiveThreadNameInBackground(
  deps: ThreadPersistenceDependencies,
  threadId: string,
  name: string,
): Promise<void> {
  const normalizedThreadId = threadId.trim();
  const normalizedName = name.trim().slice(0, THREAD_NAME_MAX_LENGTH);
  if (!normalizedThreadId || !normalizedName) {
    return;
  }
  if (normalizedThreadId !== deps.readActiveThreadId().trim()) {
    return;
  }

  const baseThread = findThreadStateById(deps.readThreads(), normalizedThreadId);
  if (!baseThread || baseThread.name === normalizedName) {
    return;
  }

  const persistencePlan = buildThreadPersistencePlanFromCurrentState({
    baseThread,
    buildThreadStateFromCurrentState: deps.buildThreadStateFromCurrentState,
    readSavedThreadSignature: deps.readSavedThreadSignature,
    includeDraftName: true,
    mapSnapshot: (snapshot) => ({
      ...snapshot,
      name: normalizedName,
    }),
  });
  if (!persistencePlan) {
    return;
  }

  await saveThreadStateToDatabase(
    deps,
    persistencePlan.snapshot,
  );
}
