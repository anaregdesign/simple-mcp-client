import type { ThreadManagementState } from "./state";

export type ThreadManagementAction =
  | {
      type: "renameStarted";
      threadId: string;
      threadName: string;
    }
  | {
      type: "renameNameChanged";
      nextName: string;
    }
  | {
      type: "renameCleared";
    };

export function threadManagementReducer(
  state: ThreadManagementState,
  action: ThreadManagementAction,
): ThreadManagementState {
  if (action.type === "renameStarted") {
    return {
      renamingThreadId: action.threadId,
      renamingThreadName: action.threadName,
    };
  }

  if (action.type === "renameNameChanged") {
    return {
      ...state,
      renamingThreadName: action.nextName,
    };
  }

  return {
    renamingThreadId: "",
    renamingThreadName: "",
  };
}
