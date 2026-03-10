import { DEFAULT_THREAD_REQUEST_STATE } from "~/lib/constants/client";
import {
  createInitialWorkspaceInteractionState,
  type WorkspaceInteractionState,
} from "~/lib/client/usecase/workspace/state";
import type {
  ThreadRequestState,
} from "~/lib/client/usecase/workspace/threads/thread-request-state";

export type WorkspaceInteractionAction =
  | { type: "thread_request_state/reset_all" }
  | {
      type: "thread_request_state/set";
      threadId: string;
      nextState: ThreadRequestState;
    }
  | { type: "thread_request_state/remove"; threadId: string }
  | {
      type: "thread_request_state/prune";
      validThreadIds: string[];
    };

export function workspaceInteractionReducer(
  state: WorkspaceInteractionState,
  action: WorkspaceInteractionAction,
): WorkspaceInteractionState {
  switch (action.type) {
    case "thread_request_state/reset_all":
      return createInitialWorkspaceInteractionState();
    case "thread_request_state/set": {
      const threadId = action.threadId.trim();
      if (!threadId) {
        return state;
      }

      return {
        ...state,
        threadRequestStateById: {
          ...state.threadRequestStateById,
          [threadId]: action.nextState,
        },
      };
    }
    case "thread_request_state/remove": {
      const threadId = action.threadId.trim();
      if (!threadId || !(threadId in state.threadRequestStateById)) {
        return state;
      }

      const nextThreadRequestStateById = {
        ...state.threadRequestStateById,
      };
      delete nextThreadRequestStateById[threadId];
      return {
        ...state,
        threadRequestStateById: nextThreadRequestStateById,
      };
    }
    case "thread_request_state/prune": {
      const validThreadIds = new Set(
        action.validThreadIds.map((threadId) => threadId.trim()).filter(Boolean),
      );
      const nextThreadRequestStateById: Record<string, ThreadRequestState> = {};
      for (const [threadId, requestState] of Object.entries(
        state.threadRequestStateById,
      )) {
        if (validThreadIds.has(threadId)) {
          nextThreadRequestStateById[threadId] = requestState;
        }
      }

      return {
        ...state,
        threadRequestStateById: nextThreadRequestStateById,
      };
    }
    default: {
      const exhaustiveAction: never = action;
      return exhaustiveAction;
    }
  }
}

export function readThreadRequestStateById(
  state: WorkspaceInteractionState,
  threadIdRaw: string,
): ThreadRequestState {
  const threadId = threadIdRaw.trim();
  if (!threadId) {
    return DEFAULT_THREAD_REQUEST_STATE;
  }

  return state.threadRequestStateById[threadId] ?? DEFAULT_THREAD_REQUEST_STATE;
}
