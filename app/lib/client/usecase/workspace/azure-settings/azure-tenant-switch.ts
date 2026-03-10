import {
  handleAzureLogin,
  runAzureLoginFlow,
} from "./azure-login";
import type {
  AzureSettingsHandlerDependencies,
  LoadAzureProjectsOptions,
  LoadAzureProjectsResult,
} from "./types";

type LoadAzureProjects = (
  deps: AzureSettingsHandlerDependencies,
  options?: LoadAzureProjectsOptions,
) => Promise<LoadAzureProjectsResult>;

export async function handleAzureTenantChange(
  deps: AzureSettingsHandlerDependencies,
  loadAzureProjects: LoadAzureProjects,
  nextTenantIdRaw: string,
): Promise<void> {
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
    const loadResult = await runAzureLoginFlow(
      deps,
      loadAzureProjects,
      nextTenantId,
    );
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
