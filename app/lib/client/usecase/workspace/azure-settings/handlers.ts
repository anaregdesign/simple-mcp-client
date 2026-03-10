import {
  createAzureCatalogHandlers,
} from "./catalog-handlers";
import {
  createAzureSessionHandlers,
} from "./session-handlers";
import type {
  AzureSettingsHandlerDependencies,
  AzureSettingsHandlers,
} from "./types";

export function createAzureSettingsHandlers(
  deps: AzureSettingsHandlerDependencies,
): AzureSettingsHandlers {
  const catalogHandlers = createAzureCatalogHandlers(deps);
  const sessionHandlers = createAzureSessionHandlers(deps, catalogHandlers);

  return {
    ...catalogHandlers,
    ...sessionHandlers,
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
