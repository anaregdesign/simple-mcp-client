import {
  DEFAULT_UTILITY_REASONING_EFFORT,
} from "~/lib/constants/chat";
import { DEFAULT_THEME_MODE } from "~/lib/constants/client";
import type { AzureSettingsState } from "./types";

export function createInitialAzureSettingsState(): AzureSettingsState {
  return {
    theme: DEFAULT_THEME_MODE,
    azureConnections: [],
    azureTenants: [],
    playgroundAzureDeployments: [],
    utilityAzureDeployments: [],
    activeAzurePrincipal: null,
    selectedPlaygroundAzureConnectionId: "",
    selectedPlaygroundAzureDeploymentName: "",
    selectedUtilityAzureConnectionId: "",
    selectedUtilityAzureDeploymentName: "",
    isLoadingAzureConnections: false,
    isLoadingPlaygroundAzureDeployments: false,
    isLoadingUtilityAzureDeployments: false,
    azureProjectCatalogCacheByTenantId: {},
    azureDeploymentCatalogCacheByTenantProjectKey: {},
    azureConnectionError: null,
    playgroundAzureDeploymentError: null,
    utilityAzureDeploymentError: null,
    isAzureAuthRequired: false,
    utilityReasoningEffort: DEFAULT_UTILITY_REASONING_EFFORT,
    isStartingAzureLogin: false,
    isSwitchingAzureTenant: false,
    isStartingAzureLogout: false,
    isReloadingAzureCatalog: false,
    azureLoginError: null,
    azureTenantSwitchError: null,
    azureLogoutError: null,
  };
}
