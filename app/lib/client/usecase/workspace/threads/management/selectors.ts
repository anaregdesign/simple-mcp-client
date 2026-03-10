import type { ThreadListOption } from "../thread-runtime";
import type { ThreadManagementState } from "./state";

export function selectIsThreadOperationBusy(options: {
  isLoadingThreads: boolean;
  isSwitchingThread: boolean;
  isCreatingThread: boolean;
  isDeletingThread: boolean;
  isClearingThread: boolean;
  isRestoringThread: boolean;
}): boolean {
  return (
    options.isLoadingThreads ||
    options.isSwitchingThread ||
    options.isCreatingThread ||
    options.isDeletingThread ||
    options.isClearingThread ||
    options.isRestoringThread
  );
}

export function hasActiveThreadRename(
  state: ThreadManagementState,
): boolean {
  return state.renamingThreadId.length > 0;
}

export function isRenamingThread(
  state: ThreadManagementState,
  threadId: string,
): boolean {
  return state.renamingThreadId === threadId;
}

export function doesActiveRenameTargetExist(
  state: ThreadManagementState,
  threads: ThreadListOption[],
): boolean {
  if (!hasActiveThreadRename(state)) {
    return false;
  }

  return threads.some((thread) => thread.id === state.renamingThreadId);
}

export function canSubmitThreadRename(
  state: ThreadManagementState,
  threadId: string,
): boolean {
  return state.renamingThreadId === threadId;
}
