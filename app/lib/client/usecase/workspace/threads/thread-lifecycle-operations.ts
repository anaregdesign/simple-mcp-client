import { DEFAULT_AGENT_INSTRUCTION } from "~/lib/constants/chat";
import { THREAD_NAME_MAX_LENGTH } from "~/lib/constants/client";
import {
  convertThreadResourceToState,
  readThreadResourceFromUnknown,
} from "~/lib/contracts/threads/parsers";
import {
  buildThreadSaveSignature,
  hasThreadInteraction,
  hasThreadPersistableState,
  upsertThreadState,
} from "~/lib/contracts/threads/state";
import {
  ClientApiError,
  mapApiError,
} from "~/lib/client/infrastructure/api/api-client";
import { threadsApiClient } from "~/lib/client/infrastructure/api/threads-api-client";
import {
  canStartThreadOperation,
} from "~/lib/client/usecase/workspace/threads/thread-operation-phase";
import { findThreadStateById } from "~/lib/client/usecase/workspace/threads/thread-runtime";
import type {
  ThreadLifecycleHandlerDependencies,
} from "~/lib/client/usecase/workspace/threads/thread-lifecycle-types";

export async function createThreadAndSwitch(
  deps: ThreadLifecycleHandlerDependencies,
  options: {
    name?: string;
  } = {},
): Promise<boolean> {
  if (!deps.beginThreadOperation("creating")) {
    return false;
  }

  deps.setThreadError(null);

  try {
    const currentThreadId = deps.readActiveThreadId().trim();
    const currentThread = findThreadStateById(deps.readThreads(), currentThreadId);
    const currentThreadState = currentThread
      ? deps.buildThreadStateFromCurrentState(currentThread)
      : null;

    if (
      currentThread &&
      currentThreadState &&
      !hasThreadPersistableState(currentThreadState) &&
      !deps.hasSavedThreadSignature(currentThread.id)
    ) {
      deps.applyThreadState(currentThread);
      return true;
    }

    if (!deps.readThreadRequestState(currentThreadId).isSending) {
      const saved = await deps.flushActiveThreadState();
      if (!saved) {
        return false;
      }
    }

    const localThread = deps.createLocalThreadState({
      name: options.name,
    });
    deps.updateThreadsState((current) => upsertThreadState(current, localThread));
    deps.setThreadsReady();
    deps.applyThreadState(localThread);
    deps.logClientInfo("create_thread_succeeded", "Thread created.", {
      action: "create_thread",
      context: {
        threadId: localThread.id,
        nameLength: localThread.name.length,
      },
    });
    return true;
  } catch (createError) {
    deps.logClientError("create_thread_failed", createError, {
      action: "create_thread",
      statusCode: 500,
    });
    deps.setThreadError(
      createError instanceof Error
        ? createError.message
        : "Failed to create thread.",
    );
    return false;
  } finally {
    deps.endThreadOperation("creating");
  }
}

export async function renameThread(
  deps: ThreadLifecycleHandlerDependencies,
  threadIdRaw: string,
  nextNameRaw: string,
): Promise<void> {
  const threadId = threadIdRaw.trim();
  if (!threadId) {
    return;
  }

  const normalizedName = nextNameRaw.trim().slice(0, THREAD_NAME_MAX_LENGTH);
  if (!normalizedName) {
    deps.setThreadError("Thread name cannot be empty.");
    return;
  }

  if (deps.isSending) {
    deps.setThreadError("Thread state is updating. Please wait.");
    return;
  }

  if (!deps.beginThreadOperation("clearing")) {
    return;
  }

  const targetThread = findThreadStateById(deps.readThreads(), threadId);
  if (!targetThread || targetThread.deletedAt !== null) {
    deps.setThreadError("Selected thread is not available.");
    return;
  }

  if (deps.readThreadRequestState(threadId).isSending) {
    deps.setThreadError("Cannot rename a thread while a response is in progress.");
    return;
  }

  if (targetThread.name === normalizedName) {
    return;
  }

  deps.setThreadError(null);
  deps.updateThreadStateById(threadId, (thread) => ({
    ...thread,
    updatedAt: new Date().toISOString(),
    name: normalizedName,
  }));

  if (threadId === deps.readActiveThreadId().trim()) {
    deps.setActiveThreadNameInput(normalizedName);
  }

  const renamedThread = findThreadStateById(deps.readThreads(), threadId);
  if (!renamedThread) {
    return;
  }

  const signature = buildThreadSaveSignature(renamedThread);
  await deps.saveThreadStateToDatabase(renamedThread, signature);
}

export function cancelThreadProcessing(
  deps: ThreadLifecycleHandlerDependencies,
  threadIdRaw: string,
): void {
  const threadId = threadIdRaw.trim();
  if (!threadId) {
    return;
  }

  const targetThread = findThreadStateById(deps.readThreads(), threadId);
  if (!targetThread || targetThread.deletedAt !== null) {
    deps.setThreadError("Selected thread is not available.");
    return;
  }

  const canceled = deps.cancelThreadInProgressProcessing(threadId);
  if (!canceled) {
    return;
  }

  deps.setThreadError(null);
  deps.setSystemNotice(
    `Canceled in-progress processing for thread ${targetThread.name}.`,
  );
  deps.logClientInfo(
    "cancel_thread_processing_succeeded",
    "Thread processing canceled.",
    {
      action: "cancel_thread_processing",
      context: {
        threadId,
      },
    },
  );
}

export async function clearThread(
  deps: ThreadLifecycleHandlerDependencies,
  threadIdRaw: string,
): Promise<void> {
  const threadId = threadIdRaw.trim();
  if (!threadId) {
    return;
  }

  if (deps.isSending) {
    deps.setThreadError("Thread state is updating. Please wait.");
    return;
  }

  if (!canStartThreadOperation(deps.threadOperationPhase)) {
    return;
  }

  const targetThread = findThreadStateById(deps.readThreads(), threadId);
  if (!targetThread || targetThread.deletedAt !== null) {
    deps.setThreadError("Selected thread is not available.");
    return;
  }

  if (deps.readThreadRequestState(threadId).isSending) {
    deps.setThreadError("Cannot clear a thread while a response is in progress.");
    return;
  }

  if (targetThread.messages.length === 0 && targetThread.mcpRpcLogs.length === 0) {
    return;
  }

  deps.setThreadError(null);

  try {
    const targetThreadForSave =
      threadId === deps.readActiveThreadId().trim()
        ? (() => {
            const activeThread = findThreadStateById(deps.readThreads(), threadId);
            if (!activeThread) {
              return null;
            }
            const snapshot = deps.buildThreadStateFromCurrentState(activeThread, {
              includeDraftName: true,
            });
            return {
              ...snapshot,
              messages: [],
              mcpRpcLogs: [],
            };
          })()
        : {
            ...targetThread,
            updatedAt: new Date().toISOString(),
            messages: [],
            mcpRpcLogs: [],
          };

    if (!targetThreadForSave) {
      return;
    }

    deps.updateThreadsState((current) => upsertThreadState(current, targetThreadForSave));
    deps.removeThreadRequestState(threadId);

    if (threadId === deps.readActiveThreadId().trim()) {
      deps.applyThreadState(targetThreadForSave);
    }

    const signature = buildThreadSaveSignature(targetThreadForSave);
    const saved = await deps.saveThreadStateToDatabase(
      targetThreadForSave,
      signature,
    );
    if (!saved) {
      return;
    }

    deps.logClientInfo("clear_thread_succeeded", "Thread content cleared.", {
      action: "clear_thread",
      context: {
        threadId,
      },
    });
  } catch (clearError) {
    deps.logClientError("clear_thread_failed", clearError, {
      action: "clear_thread",
      statusCode: 500,
      context: {
        threadId,
      },
    });
    deps.setThreadError(
      clearError instanceof Error
        ? clearError.message
        : "Failed to clear thread.",
    );
  } finally {
    deps.endThreadOperation("clearing");
  }
}

export async function deleteThread(
  deps: ThreadLifecycleHandlerDependencies,
  threadIdRaw: string,
): Promise<void> {
  const threadId = threadIdRaw.trim();
  if (!threadId) {
    return;
  }

  if (deps.isSending) {
    deps.setThreadError("Thread state is updating. Please wait.");
    return;
  }

  if (!deps.beginThreadOperation("deleting")) {
    return;
  }

  const targetThread = findThreadStateById(deps.readThreads(), threadId);
  if (!targetThread || targetThread.deletedAt !== null) {
    deps.setThreadError("Selected thread is not available.");
    return;
  }
  if (!hasThreadInteraction(targetThread)) {
    deps.setThreadError("Threads without messages cannot be deleted.");
    return;
  }

  if (deps.readThreadRequestState(threadId).isSending) {
    deps.setThreadError("Cannot delete a thread while a response is in progress.");
    return;
  }

  deps.setThreadError(null);

  try {
    const currentThreadId = deps.readActiveThreadId().trim();
    if (!deps.readThreadRequestState(currentThreadId).isSending) {
      const saved = await deps.flushActiveThreadState();
      if (!saved) {
        return;
      }
    }

    const payload = await threadsApiClient.deleteThread(threadId, {
      onAuthRequired: () => {
        deps.markAzureAuthRequired();
      },
    });

    const deletedThreadResource = readThreadResourceFromUnknown(payload.thread);
    const deletedThread = deletedThreadResource
      ? convertThreadResourceToState(deletedThreadResource, {
          fallbackInstruction: DEFAULT_AGENT_INSTRUCTION,
        })
      : null;
    if (
      !deletedThread ||
      deletedThread.id !== threadId ||
      deletedThread.deletedAt === null
    ) {
      throw new Error("Deleted thread payload is invalid.");
    }

    deps.removeThreadRequestState(threadId);
    await deps.loadThreads();
    deps.logClientInfo("delete_thread_succeeded", "Thread archived.", {
      action: "delete_thread",
      context: {
        threadId,
      },
    });
  } catch (deleteError) {
    if (
      deleteError instanceof ClientApiError &&
      deleteError.kind === "auth_required"
    ) {
      deps.setThreadError(deleteError.message);
      return;
    }
    deps.logClientError("delete_thread_failed", deleteError, {
      action: "delete_thread",
      statusCode: 500,
      context: {
        threadId,
      },
    });
    deps.setThreadError(mapApiError(deleteError, "Failed to delete thread."));
  } finally {
    deps.endThreadOperation("deleting");
  }
}

export async function restoreThread(
  deps: ThreadLifecycleHandlerDependencies,
  threadIdRaw: string,
): Promise<void> {
  const threadId = threadIdRaw.trim();
  if (!threadId) {
    return;
  }

  if (deps.isSending) {
    deps.setThreadError("Thread state is updating. Please wait.");
    return;
  }

  if (!deps.beginThreadOperation("restoring")) {
    return;
  }

  const targetThread = findThreadStateById(deps.readThreads(), threadId);
  if (!targetThread || targetThread.deletedAt === null) {
    deps.setThreadError("Selected archive is not available.");
    return;
  }

  deps.setThreadError(null);

  try {
    const currentThreadId = deps.readActiveThreadId().trim();
    if (!deps.readThreadRequestState(currentThreadId).isSending) {
      const saved = await deps.flushActiveThreadState();
      if (!saved) {
        return;
      }
    }

    const payload = await threadsApiClient.restoreThread(threadId, {
      onAuthRequired: () => {
        deps.markAzureAuthRequired();
      },
    });

    const restoredThreadResource = readThreadResourceFromUnknown(payload.thread);
    const restoredThread = restoredThreadResource
      ? convertThreadResourceToState(restoredThreadResource, {
          fallbackInstruction: DEFAULT_AGENT_INSTRUCTION,
        })
      : null;
    if (
      !restoredThread ||
      restoredThread.id !== threadId ||
      restoredThread.deletedAt !== null
    ) {
      throw new Error("Restored thread payload is invalid.");
    }

    deps.updateThreadsState((current) => upsertThreadState(current, restoredThread));
    deps.rememberThreadSaveSignature(restoredThread);
    deps.applyThreadState(restoredThread);
    deps.logClientInfo("restore_thread_succeeded", "Thread restored.", {
      action: "restore_thread",
      context: {
        threadId,
      },
    });
  } catch (restoreError) {
    if (
      restoreError instanceof ClientApiError &&
      restoreError.kind === "auth_required"
    ) {
      deps.setThreadError(restoreError.message);
      return;
    }
    deps.logClientError("restore_thread_failed", restoreError, {
      action: "restore_thread",
      statusCode: 500,
      context: {
        threadId,
      },
    });
    deps.setThreadError(mapApiError(restoreError, "Failed to restore thread."));
  } finally {
    deps.endThreadOperation("restoring");
  }
}

export async function switchThread(
  deps: ThreadLifecycleHandlerDependencies,
  nextThreadIdRaw: string,
): Promise<void> {
  const nextThreadId = nextThreadIdRaw.trim();
  deps.setThreadError(null);
  if (!nextThreadId || nextThreadId === deps.readActiveThreadId()) {
    return;
  }

  const nextThread = findThreadStateById(deps.readThreads(), nextThreadId);
  if (!nextThread) {
    deps.setThreadError("Selected thread is not available.");
    return;
  }
  if (!deps.beginThreadOperation("switching")) {
    return;
  }
  try {
    const currentThreadId = deps.readActiveThreadId().trim();
    if (!deps.readThreadRequestState(currentThreadId).isSending) {
      const saved = await deps.flushActiveThreadState();
      if (!saved) {
        return;
      }
    }

    deps.applyThreadState(nextThread);
    deps.logClientInfo("switch_thread_succeeded", "Thread switched.", {
      action: "switch_thread",
      context: {
        fromThreadId: currentThreadId,
        toThreadId: nextThread.id,
      },
    });
  } finally {
    deps.endThreadOperation("switching");
  }
}
