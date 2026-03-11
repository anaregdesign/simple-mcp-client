import {
  DEFAULT_UTILITY_REASONING_EFFORT,
} from "~/lib/constants/chat";
import {
  shouldScheduleWorkspaceMcpServerProfileLoginRetry,
} from "~/lib/client/usecase/workspace/mcp-profiles/selectors";
import {
  cancelAzureDeploymentLoads,
} from "./deployment-selection";
import type {
  AzureSettingsState,
  AzureSettingsHandlerDependencies,
} from "./types";

const AZURE_AUTH_REQUIRED_THREADS_MESSAGE =
  "Azure login is required. Open Settings and sign in to load threads.";

export function clearWorkspaceMcpServerProfileLoginRetry(
  deps: AzureSettingsHandlerDependencies,
): void {
  deps.clearWorkspaceMcpServerProfileLoginRetryTimeout();
}

export function clearActiveAzureIdentity(
  deps: AzureSettingsHandlerDependencies,
  cancelAzureDeploymentLoads: () => void,
): void {
  deps.options.writeActiveAzureTenantId("");
  deps.options.writeActiveAzurePrincipalId("");
  deps.options.writeActiveWorkspaceUserKey("");
  deps.writePreferredAzureSelection(null);
  cancelAzureDeploymentLoads();
  deps.dispatch({ type: "cache/clear_all" });
  deps.patchState({
    azureTenants: [],
    activeAzurePrincipal: null,
    azureTenantSwitchError: null,
    isReloadingAzureCatalog: false,
    utilityReasoningEffort: DEFAULT_UTILITY_REASONING_EFFORT,
  });
}

export function applyAzureAuthRequiredState(
  deps: AzureSettingsHandlerDependencies,
  patch: Partial<AzureSettingsState> = {},
): void {
  clearWorkspaceMcpServerProfileLoginRetry(deps);
  clearActiveAzureIdentity(deps, () => cancelAzureDeploymentLoads(deps));
  deps.options.clearWorkspaceMcpServerProfilesState();
  deps.options.clearThreadsState(AZURE_AUTH_REQUIRED_THREADS_MESSAGE);
  deps.patchState({
    isAzureAuthRequired: true,
    azureConnections: [],
    playgroundAzureDeployments: [],
    utilityAzureDeployments: [],
    isLoadingPlaygroundAzureDeployments: false,
    isLoadingUtilityAzureDeployments: false,
    selectedPlaygroundAzureConnectionId: "",
    selectedPlaygroundAzureDeploymentName: "",
    selectedUtilityAzureConnectionId: "",
    selectedUtilityAzureDeploymentName: "",
    utilityReasoningEffort: DEFAULT_UTILITY_REASONING_EFFORT,
    azureConnectionError: null,
    playgroundAzureDeploymentError: null,
    utilityAzureDeploymentError: null,
    ...patch,
  });
}

export function updateActiveAzureIdentity(
  deps: AzureSettingsHandlerDependencies,
  tenantId: string,
  principalId: string,
): string {
  deps.options.writeActiveAzureTenantId(tenantId);
  deps.options.writeActiveAzurePrincipalId(principalId);
  const nextWorkspaceUserKey =
    tenantId && principalId ? `${tenantId}::${principalId}` : "";
  deps.options.writeActiveWorkspaceUserKey(nextWorkspaceUserKey);
  return nextWorkspaceUserKey;
}

async function reloadWorkspaceStateForActiveIdentity(
  deps: AzureSettingsHandlerDependencies,
  waitForWorkspaceStateReload: boolean,
): Promise<void> {
  deps.options.clearWorkspaceMcpServerProfilesState();
  deps.options.clearThreadsState();

  const nextWorkspaceUserKey =
    deps.options.readActiveWorkspaceUserKey().trim();
  if (!nextWorkspaceUserKey) {
    return;
  }

  deps.options.showThreadReloadPlaceholder();

  const reloadState = async () => {
    await deps.options.loadWorkspaceMcpServerProfiles();
    await deps.options.loadThreads();
  };

  if (waitForWorkspaceStateReload) {
    await reloadState();
    return;
  }

  void reloadState();
}

function scheduleWorkspaceMcpServerProfileLoginRetryForIdentity(
  deps: AzureSettingsHandlerDependencies,
  expectedUserKey: string,
): void {
  deps.scheduleWorkspaceMcpServerProfileLoginRetryTimeout(() => {
    if (deps.options.readActiveWorkspaceUserKey() === expectedUserKey) {
      void deps.options.loadWorkspaceMcpServerProfiles();
    }
  });
}

export async function syncWorkspaceStateForLoadedIdentity(
  deps: AzureSettingsHandlerDependencies,
  options: {
    currentAuthRequired: boolean;
    previousWorkspaceUserKey: string;
    nextWorkspaceUserKey: string;
    waitForWorkspaceStateReload: boolean;
  },
): Promise<void> {
  if (!options.nextWorkspaceUserKey) {
    deps.options.clearWorkspaceMcpServerProfilesState();
    deps.options.clearThreadsState();
  } else if (
    options.previousWorkspaceUserKey !== options.nextWorkspaceUserKey
  ) {
    await reloadWorkspaceStateForActiveIdentity(
      deps,
      options.waitForWorkspaceStateReload,
    );
  } else if (
    !deps.options.readIsThreadsReady() &&
    !deps.options.readIsLoadingThreads() &&
    deps.readState().isAzureAuthRequired === false
  ) {
    if (options.waitForWorkspaceStateReload) {
      await deps.options.loadThreads();
    } else {
      void deps.options.loadThreads();
    }
  }

  if (
    shouldScheduleWorkspaceMcpServerProfileLoginRetry(
      options.currentAuthRequired,
      options.nextWorkspaceUserKey,
    )
  ) {
    scheduleWorkspaceMcpServerProfileLoginRetryForIdentity(
      deps,
      options.nextWorkspaceUserKey,
    );
  } else {
    clearWorkspaceMcpServerProfileLoginRetry(deps);
  }
}
