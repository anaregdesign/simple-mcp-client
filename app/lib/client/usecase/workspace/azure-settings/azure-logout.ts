import {
  azureSessionApiClient,
} from "~/lib/client/infrastructure/api/azure-session-api-client";
import type {
  AzureSettingsHandlerDependencies,
  LoadAzureProjectsOptions,
  LoadAzureProjectsResult,
} from "./types";

type LoadAzureProjects = (
  deps: AzureSettingsHandlerDependencies,
  options?: LoadAzureProjectsOptions,
) => Promise<LoadAzureProjectsResult>;

export async function handleAzureLogout(
  deps: AzureSettingsHandlerDependencies,
  loadAzureProjects: LoadAzureProjects,
): Promise<void> {
  const currentState = deps.readState();
  if (
    currentState.isStartingAzureLogout ||
    currentState.isSwitchingAzureTenant
  ) {
    return;
  }

  deps.options.setSystemNotice(null);
  deps.patchState({
    azureLogoutError: null,
    azureTenantSwitchError: null,
    isStartingAzureLogout: true,
  });
  try {
    const payload = await azureSessionApiClient.endSession();
    deps.patchState({
      playgroundAzureDeploymentError: null,
      utilityAzureDeploymentError: null,
    });
    await loadAzureProjects(deps, { force: true });
    deps.options.setSystemNotice(payload.message || "Azure logout completed.");
  } catch (logoutError) {
    deps.options.logClientError("azure_logout_flow_failed", logoutError, {
      action: "azure_logout",
    });
    deps.patchState({
      azureLogoutError:
        logoutError instanceof Error
          ? logoutError.message
          : "Failed to run Azure logout.",
    });
  } finally {
    deps.patchState({
      isStartingAzureLogout: false,
    });
  }
}
