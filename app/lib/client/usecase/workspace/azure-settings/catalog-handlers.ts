import {
  createAzureCatalogRuntime,
} from "./catalog-runtime";
import {
  createAzureCatalogOperations,
} from "./catalog-operations";
import type {
  AzureSettingsHandlerDependencies,
  AzureSettingsHandlers,
} from "./types";

export type AzureCatalogHandlers = Pick<
  AzureSettingsHandlers,
  | "cancelAzureDeploymentLoad"
  | "clearWorkspaceMcpServerProfileLoginRetryTimeout"
  | "saveAzureSelectionPreference"
  | "saveThemePreference"
  | "loadAzureProjects"
  | "loadAzureDeployments"
>;

export function createAzureCatalogHandlers(
  deps: AzureSettingsHandlerDependencies,
): AzureCatalogHandlers {
  const runtime = createAzureCatalogRuntime(deps);
  const {
    cancelAzureDeploymentLoad,
    clearWorkspaceMcpServerProfileLoginRetryTimeout,
    saveAzureSelectionPreference,
    saveThemePreference,
  } = runtime;
  const operations = createAzureCatalogOperations(deps, runtime);

  return {
    cancelAzureDeploymentLoad,
    clearWorkspaceMcpServerProfileLoginRetryTimeout,
    saveAzureSelectionPreference,
    saveThemePreference,
    loadAzureProjects: operations.loadAzureProjects,
    loadAzureDeployments: operations.loadAzureDeployments,
  };
}
