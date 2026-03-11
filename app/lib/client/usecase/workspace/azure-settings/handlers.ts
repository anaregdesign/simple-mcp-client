import {
  clearWorkspaceMcpServerProfileLoginRetry,
} from "./catalog-identity";
import {
  saveAzureSelectionPreference,
  saveThemePreference,
} from "./catalog-preferences";
import {
  cancelAzureDeploymentLoad,
} from "./deployment-selection";
import {
  loadAzureProjects,
} from "./project-catalog-loading";
import {
  loadAzureDeployments,
} from "./deployment-catalog-loading";
import {
  handleAzureLogin,
} from "./azure-login";
import {
  handleAzureTenantChange,
} from "./azure-tenant-switch";
import {
  handleAzureLogout,
} from "./azure-logout";
import {
  handleReloadAzureCatalog,
} from "./azure-catalog-reload";
import type {
  AzureSettingsHandlerDependencies,
  AzureSettingsHandlers,
} from "./types";

export function createAzureSettingsHandlers(
  deps: AzureSettingsHandlerDependencies,
): AzureSettingsHandlers {
  return {
    cancelAzureDeploymentLoad(target) {
      cancelAzureDeploymentLoad(deps, target);
    },
    clearWorkspaceMcpServerProfileLoginRetryTimeout() {
      clearWorkspaceMcpServerProfileLoginRetry(deps);
    },
    saveAzureSelectionPreference(selection) {
      return saveAzureSelectionPreference(deps, selection);
    },
    saveThemePreference(nextTheme) {
      return saveThemePreference(deps, nextTheme);
    },
    loadAzureProjects(loadOptions) {
      return loadAzureProjects(deps, loadOptions);
    },
    loadAzureDeployments(projectId, target, loadOptions) {
      return loadAzureDeployments(deps, projectId, target, loadOptions);
    },
    handleAzureLogin() {
      return handleAzureLogin(deps, loadAzureProjects);
    },
    handleAzureTenantChange(nextTenantId) {
      return handleAzureTenantChange(deps, loadAzureProjects, nextTenantId);
    },
    handleAzureLogout() {
      return handleAzureLogout(deps, loadAzureProjects);
    },
    handleReloadAzureCatalog() {
      return handleReloadAzureCatalog(deps, loadAzureProjects);
    },
    handleSelectPlaygroundProject(projectId: string) {
      deps.patchState({
        selectedPlaygroundAzureConnectionId: projectId,
        selectedPlaygroundAzureDeploymentName: "",
        playgroundAzureDeploymentError: null,
      });
    },
    handleSelectPlaygroundDeployment(deploymentName: string) {
      deps.patchState({
        selectedPlaygroundAzureDeploymentName: deploymentName.trim(),
      });
    },
    handleSelectUtilityProject(projectId: string) {
      deps.patchState({
        selectedUtilityAzureConnectionId: projectId,
        selectedUtilityAzureDeploymentName: "",
        utilityAzureDeploymentError: null,
      });
    },
    handleSelectUtilityDeployment(deploymentName: string) {
      deps.patchState({
        selectedUtilityAzureDeploymentName: deploymentName.trim(),
      });
    },
    handleUtilityReasoningEffortChange(value) {
      deps.patchState({
        utilityReasoningEffort: value,
      });
    },
  };
}
