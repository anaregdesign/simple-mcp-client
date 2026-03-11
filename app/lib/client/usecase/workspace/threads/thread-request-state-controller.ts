import type { Dispatch } from "react";
import {
  readThreadRequestStateById,
  type ThreadRequestStateAction,
} from "./thread-request-state-store";
import type { ThreadRequestState } from "./thread-request-state";

type CreateThreadRequestStateControllerOptions = {
  readThreadRequestStateByIdRecord: () => Record<string, ThreadRequestState>;
  readThreadSendAbortController: (
    threadId: string,
  ) => AbortController | undefined;
  writeThreadSendAbortController: (
    threadId: string,
    abortController: AbortController,
  ) => void;
  clearThreadSendAbortControllerEntry: (threadId: string) => void;
  dispatchThreadRequestState: Dispatch<ThreadRequestStateAction>;
};

export function createThreadRequestStateController(
  options: CreateThreadRequestStateControllerOptions,
) {
  function readThreadRequestState(threadId: string): ThreadRequestState {
    return readThreadRequestStateById(
      {
        threadRequestStateById: options.readThreadRequestStateByIdRecord(),
      },
      threadId,
    );
  }

  function updateThreadRequestState(
    threadId: string,
    updater: (current: ThreadRequestState) => ThreadRequestState,
  ): void {
    if (!threadId) {
      return;
    }

    options.dispatchThreadRequestState({
      type: "thread_request_state/set",
      threadId,
      nextState: updater(readThreadRequestState(threadId)),
    });
  }

  function assignThreadSendAbortController(
    threadId: string,
    abortController: AbortController,
  ): void {
    const normalizedThreadId = threadId.trim();
    if (!normalizedThreadId) {
      return;
    }

    options.writeThreadSendAbortController(normalizedThreadId, abortController);
  }

  function clearThreadSendAbortController(
    threadId: string,
    abortController?: AbortController,
  ): void {
    const normalizedThreadId = threadId.trim();
    if (!normalizedThreadId) {
      return;
    }

    if (abortController) {
      const current = options.readThreadSendAbortController(normalizedThreadId);
      if (current !== abortController) {
        return;
      }
    }

    options.clearThreadSendAbortControllerEntry(normalizedThreadId);
  }

  function cancelThreadInProgressProcessing(threadIdRaw: string): boolean {
    const threadId = threadIdRaw.trim();
    if (!threadId) {
      return false;
    }

    const currentState = readThreadRequestState(threadId);
    if (!currentState.isSending) {
      return false;
    }

    const abortController = options.readThreadSendAbortController(threadId);
    if (abortController) {
      abortController.abort();
      options.clearThreadSendAbortControllerEntry(threadId);
    }

    updateThreadRequestState(threadId, (current) => ({
      ...current,
      isSending: false,
      sendProgressMessages: [],
      activeTurnId: null,
      lastErrorTurnId: null,
      error: null,
    }));
    return true;
  }

  function appendThreadProgressMessage(
    threadId: string,
    message: string,
  ): void {
    const trimmed = message.trim();
    if (!threadId || !trimmed) {
      return;
    }

    updateThreadRequestState(threadId, (current) => {
      if (
        current.sendProgressMessages[
          current.sendProgressMessages.length - 1
        ] === trimmed
      ) {
        return current;
      }

      const nextMessages = [...current.sendProgressMessages, trimmed].slice(-8);
      return {
        ...current,
        sendProgressMessages: nextMessages,
      };
    });
  }

  return {
    readThreadRequestState,
    updateThreadRequestState,
    assignThreadSendAbortController,
    clearThreadSendAbortController,
    cancelThreadInProgressProcessing,
    appendThreadProgressMessage,
  };
}
