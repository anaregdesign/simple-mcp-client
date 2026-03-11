import {
  isAzureProjectsLoadReady,
} from "./catalog-state";
import type {
  AzureSettingsHandlerDependencies,
  LoadAzureProjectsOptions,
  LoadAzureProjectsResult,
} from "./types";

type LoadAzureProjects = (
  deps: AzureSettingsHandlerDependencies,
  options?: LoadAzureProjectsOptions,
) => Promise<LoadAzureProjectsResult>;

export async function handleReloadAzureCatalog(
  deps: AzureSettingsHandlerDependencies,
  loadAzureProjects: LoadAzureProjects,
): Promise<void> {
  const currentState = deps.readState();
  if (
    currentState.isAzureAuthRequired ||
    currentState.isReloadingAzureCatalog ||
    currentState.isStartingAzureLogin ||
    currentState.isSwitchingAzureTenant ||
    currentState.isStartingAzureLogout ||
    currentState.isLoadingAzureConnections ||
    currentState.isLoadingPlaygroundAzureDeployments ||
    currentState.isLoadingUtilityAzureDeployments
  ) {
    return;
  }

  deps.options.setSystemNotice(null);
  deps.patchState({
    azureConnectionError: null,
    playgroundAzureDeploymentError: null,
    utilityAzureDeploymentError: null,
    azureTenantSwitchError: null,
    azureLoginError: null,
    isReloadingAzureCatalog: true,
  });

  try {
    deps.dispatch({
      type: "cache/clear_tenant",
      tenantId: deps.options.readActiveAzureTenantId(),
    });
    const loadResult = await loadAzureProjects(deps, {
      force: true,
    });
    if (isAzureProjectsLoadReady(loadResult)) {
      deps.options.setSystemNotice("Azure catalog reloaded.");
    }
  } catch (reloadError) {
    deps.options.logClientError(
      "azure_catalog_reload_failed",
      reloadError,
      {
        action: "azure_catalog_reload",
      },
    );
    deps.patchState({
      azureConnectionError:
        reloadError instanceof Error
          ? reloadError.message
          : "Failed to reload Azure catalog.",
    });
  } finally {
    deps.patchState({
      isReloadingAzureCatalog: false,
    });
  }
}
