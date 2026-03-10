import type {
  ThreadRequestState,
} from "~/lib/client/usecase/workspace/threads/thread-request-state";

export type WorkspaceInteractionState = {
  threadRequestStateById: Record<string, ThreadRequestState>;
};

export function createInitialWorkspaceInteractionState(): WorkspaceInteractionState {
  return {
    threadRequestStateById: {},
  };
}
