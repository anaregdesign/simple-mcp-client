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
  AzureSettingsHandlers,
  LoadAzureProjectsResult,
} from "./types";

type AzureSessionCatalogHandlers = Pick<AzureSettingsHandlers, "loadAzureProjects">;

export function createAzureSessionOperations(
  deps: AzureSettingsHandlerDependencies,
  catalogHandlers: AzureSessionCatalogHandlers,
) {
  async function runAzureLoginFlow(
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
      loadResult = await catalogHandlers.loadAzureProjects(
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

  async function handleAzureLogin(): Promise<void> {
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
      await runAzureLoginFlow();
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

  async function handleAzureTenantChange(nextTenantIdRaw: string): Promise<void> {
    const currentState = deps.readState();
    if (
      currentState.isAzureAuthRequired ||
      currentState.isStartingAzureLogin ||
      currentState.isSwitchingAzureTenant ||
      currentState.isStartingAzureLogout
    ) {
      return;
    }

    const nextTenantId = nextTenantIdRaw.trim();
    const activeTenantId = deps.options.readActiveAzureTenantId().trim();
    if (!nextTenantId || nextTenantId === activeTenantId) {
      return;
    }

    deps.options.setSystemNotice(null);
    deps.patchState({
      azureTenantSwitchError: null,
      azureLoginError: null,
      isSwitchingAzureTenant: true,
    });
    try {
      const loadResult = await runAzureLoginFlow(nextTenantId);
      if (loadResult.tenantSwitchPending) {
        deps.patchState({
          azureTenantSwitchError:
            "Azure tenant switch is still applying. Retry Azure Login if this persists.",
        });
      } else if (loadResult.authRequired) {
        deps.patchState({
          azureTenantSwitchError:
            "Failed to switch Azure tenant. Retry Azure Login.",
        });
      }
    } catch (switchError) {
      deps.options.logClientError(
        "azure_tenant_switch_failed",
        switchError,
        {
          action: "azure_tenant_switch",
          context: {
            tenantId: nextTenantId,
          },
        },
      );
      deps.patchState({
        azureTenantSwitchError:
          switchError instanceof Error
            ? switchError.message
            : "Failed to switch Azure tenant.",
      });
    } finally {
      deps.patchState({
        isSwitchingAzureTenant: false,
      });
    }
  }

  async function handleAzureLogout(): Promise<void> {
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
      await catalogHandlers.loadAzureProjects({ force: true });
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

  async function handleReloadAzureCatalog(): Promise<void> {
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
      const loadResult = await catalogHandlers.loadAzureProjects({
        force: true,
      });
      if (isAzureProjectsLoadReady(loadResult)) {
        deps.options.setSystemNotice("Azure catalog reloaded.");
      }
    } finally {
      deps.patchState({
        isReloadingAzureCatalog: false,
      });
    }
  }

  return {
    handleAzureLogin,
    handleAzureTenantChange,
    handleAzureLogout,
    handleReloadAzureCatalog,
  };
}
