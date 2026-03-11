import {
  azureSessionApiClient,
} from "~/lib/client/infrastructure/api/azure-session-api-client";
import {
  waitForAzureCatalogRetryDelay,
} from "~/lib/client/infrastructure/browser/azure-settings";
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

export async function runAzureLoginFlow(
  deps: AzureSettingsHandlerDependencies,
  loadAzureProjects: LoadAzureProjects,
  targetTenantIdRaw = "",
): Promise<LoadAzureProjectsResult> {
  const targetTenantId = targetTenantIdRaw.trim();
  const waitForWorkspaceStateReload = targetTenantId.length > 0;
  const payload = await azureSessionApiClient.startSession(targetTenantId);
  deps.options.setSystemNotice(
    targetTenantId
      ? "Azure tenant switched. Azure projects were refreshed."
      : payload.message || "Azure login completed.",
  );

  deps.patchState({
    isAzureAuthRequired: false,
    azureConnectionError: null,
    playgroundAzureDeploymentError: null,
    utilityAzureDeploymentError: null,
  });

  let loadResult: LoadAzureProjectsResult = {
    authRequired: true,
    tenantSwitchPending: false,
  };
  for (let attempt = 0; attempt < 6; attempt += 1) {
    loadResult = await loadAzureProjects(
      deps,
      targetTenantId
        ? {
            preferredTenantId: targetTenantId,
            force: true,
            waitForWorkspaceStateReload,
          }
        : {
            preferredTenantId: targetTenantId,
            waitForWorkspaceStateReload,
          },
    );
    if (isAzureProjectsLoadReady(loadResult)) {
      break;
    }

    await waitForAzureCatalogRetryDelay();
  }
  if (loadResult.authRequired) {
    deps.patchState({
      isAzureAuthRequired: true,
    });
  }

  deps.patchState({
    azureLoginError: null,
  });

  return loadResult;
}

export async function handleAzureLogin(
  deps: AzureSettingsHandlerDependencies,
  loadAzureProjects: LoadAzureProjects,
): Promise<void> {
  const currentState = deps.readState();
  if (
    currentState.isStartingAzureLogin ||
    currentState.isSwitchingAzureTenant
  ) {
    return;
  }

  deps.options.setSystemNotice(null);
  deps.patchState({
    azureLoginError: null,
    azureTenantSwitchError: null,
    isStartingAzureLogin: true,
  });
  try {
    await runAzureLoginFlow(deps, loadAzureProjects);
  } catch (loginError) {
    deps.options.logClientError("azure_login_flow_failed", loginError, {
      action: "azure_login",
    });
    deps.patchState({
      azureLoginError:
        loginError instanceof Error
          ? loginError.message
          : "Failed to start Azure login.",
    });
  } finally {
    deps.patchState({
      isStartingAzureLogin: false,
    });
  }
}
