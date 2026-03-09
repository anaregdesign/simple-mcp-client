import type { ThreadRequestState } from "~/lib/client/usecase/workspace/types";

export type WorkspaceInteractionState = {
  threadRequestStateById: Record<string, ThreadRequestState>;
};

export function createInitialWorkspaceInteractionState(): WorkspaceInteractionState {
  return {
    threadRequestStateById: {},
  };
}
