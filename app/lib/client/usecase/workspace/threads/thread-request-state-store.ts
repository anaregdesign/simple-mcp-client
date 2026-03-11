import { DEFAULT_THREAD_REQUEST_STATE } from "~/lib/constants/client";
import type { ThreadRequestState } from "./thread-request-state";

export type ThreadRequestStateCollection = {
  threadRequestStateById: Record<string, ThreadRequestState>;
};

export type ThreadRequestStateAction =
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

export function createInitialThreadRequestStateCollection(): ThreadRequestStateCollection {
  return {
    threadRequestStateById: {},
  };
}

export function threadRequestStateReducer(
  state: ThreadRequestStateCollection,
  action: ThreadRequestStateAction,
): ThreadRequestStateCollection {
  switch (action.type) {
    case "thread_request_state/reset_all":
      return createInitialThreadRequestStateCollection();
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
  state: ThreadRequestStateCollection,
  threadIdRaw: string,
): ThreadRequestState {
  const threadId = threadIdRaw.trim();
  if (!threadId) {
    return DEFAULT_THREAD_REQUEST_STATE;
  }

  return state.threadRequestStateById[threadId] ?? DEFAULT_THREAD_REQUEST_STATE;
}
