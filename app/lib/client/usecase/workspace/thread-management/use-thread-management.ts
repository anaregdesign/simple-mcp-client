import { useEffect, useReducer, useRef } from "react";
import {
  normalizeThreadRenameInput,
  resolveThreadRenameKeyAction,
} from "./handlers";
import { threadManagementReducer } from "./reducer";
import {
  canSubmitThreadRename,
  doesActiveRenameTargetExist,
  hasActiveThreadRename,
  selectIsThreadOperationBusy,
} from "./selectors";
import { initialThreadManagementState } from "./state";
import type {
  ThreadManagementHookOptions,
  ThreadManagementViewModel,
} from "./types";

export function useThreadManagement(
  options: ThreadManagementHookOptions,
): ThreadManagementViewModel {
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const skipNextRenameSubmitRef = useRef(false);
  const [state, dispatch] = useReducer(
    threadManagementReducer,
    initialThreadManagementState,
  );
  const isThreadOperationBusy = selectIsThreadOperationBusy(options);

  function clearThreadRenameState(skipNextBlurSubmit = false) {
    if (skipNextBlurSubmit) {
      skipNextRenameSubmitRef.current = true;
    }
    dispatch({ type: "renameCleared" });
  }

  function submitThreadRename(threadId: string) {
    if (!canSubmitThreadRename(state, threadId)) {
      return;
    }

    const nextName = state.renamingThreadName;
    clearThreadRenameState();
    options.onThreadRename(threadId, nextName);
  }

  useEffect(() => {
    if (!hasActiveThreadRename(state)) {
      return;
    }

    renameInputRef.current?.focus();
    renameInputRef.current?.select();
  }, [state.renamingThreadId]);

  useEffect(() => {
    if (!hasActiveThreadRename(state)) {
      return;
    }

    if (doesActiveRenameTargetExist(state, options.activeThreadOptions)) {
      return;
    }

    clearThreadRenameState(true);
  }, [options.activeThreadOptions, state.renamingThreadId]);

  useEffect(() => {
    if (!isThreadOperationBusy || !hasActiveThreadRename(state)) {
      return;
    }

    clearThreadRenameState(true);
  }, [isThreadOperationBusy, state.renamingThreadId]);

  return {
    renameInputRef,
    renamingThreadId: state.renamingThreadId,
    renamingThreadName: state.renamingThreadName,
    isThreadOperationBusy,
    handleBeginThreadRename(thread) {
      dispatch({
        type: "renameStarted",
        threadId: thread.id,
        threadName: thread.name,
      });
    },
    handleRenameInputChange(value) {
      dispatch({
        type: "renameNameChanged",
        nextName: normalizeThreadRenameInput(value),
      });
    },
    handleRenameInputBlur(thread) {
      if (skipNextRenameSubmitRef.current) {
        skipNextRenameSubmitRef.current = false;
        return;
      }

      submitThreadRename(thread.id);
    },
    handleRenameInputKeyDown(event, thread) {
      const action = resolveThreadRenameKeyAction(event.key);
      if (action === "submit") {
        event.preventDefault();
        submitThreadRename(thread.id);
        return;
      }

      if (action === "cancel") {
        event.preventDefault();
        clearThreadRenameState(true);
      }
    },
  };
}
