import {
  useReducer,
  useRef,
} from "react";
import {
  useConfigPanelState,
} from "~/lib/client/usecase/workspace/config-panel/use-config-panel";
import {
  useWorkspaceLayout,
} from "~/lib/client/usecase/workspace/layout/use-layout";
import {
  usePlaygroundSession,
} from "~/lib/client/usecase/workspace/playground-panel/use-playground-session";
import {
  createInitialThreadRequestStateCollection,
  threadRequestStateReducer,
} from "~/lib/client/usecase/workspace/threads/thread-request-state-store";

export function useWorkspaceScreenRuntime() {
  const playgroundSession = usePlaygroundSession();
  const configPanelState = useConfigPanelState();
  const [threadRequestStateCollection, dispatchThreadRequestState] = useReducer(
    threadRequestStateReducer,
    undefined,
    createInitialThreadRequestStateCollection,
  );
  const activeAzureTenantIdRef = useRef("");
  const activeAzurePrincipalIdRef = useRef("");
  const activeWorkspaceUserKeyRef = useRef("");
  const selectedPlaygroundAzureConnectionIdRef = useRef("");
  const selectedPlaygroundAzureDeploymentNameRef = useRef("");
  const selectedUtilityAzureConnectionIdRef = useRef("");
  const selectedUtilityAzureDeploymentNameRef = useRef("");
  const layout = useWorkspaceLayout();

  return {
    ...playgroundSession,
    ...configPanelState,
    threadRequestStateCollection,
    dispatchThreadRequestState,
    activeAzureTenantIdRef,
    activeAzurePrincipalIdRef,
    activeWorkspaceUserKeyRef,
    selectedPlaygroundAzureConnectionIdRef,
    selectedPlaygroundAzureDeploymentNameRef,
    selectedUtilityAzureConnectionIdRef,
    selectedUtilityAzureDeploymentNameRef,
    ...layout,
  };
}

export type WorkspaceScreenRuntime = ReturnType<
  typeof useWorkspaceScreenRuntime
>;
