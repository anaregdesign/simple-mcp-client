import {
  resolveAzureAuthRequiredState,
} from "./catalog-state";
import type {
  AzureDeploymentTarget,
  AzureSettingsHandlerDependencies,
  AzureSettingsState,
} from "./types";

export function cancelAzureDeploymentLoad(
  deps: AzureSettingsHandlerDependencies,
  target: AzureDeploymentTarget,
): void {
  deps.nextAzureDeploymentRequestSeq(target);
  if (target === "playground") {
    deps.patchState({
      isLoadingPlaygroundAzureDeployments: false,
    });
    return;
  }

  deps.patchState({
    isLoadingUtilityAzureDeployments: false,
  });
}

export function cancelAzureDeploymentLoads(
  deps: AzureSettingsHandlerDependencies,
): void {
  cancelAzureDeploymentLoad(deps, "playground");
  cancelAzureDeploymentLoad(deps, "utility");
}

export function applyAzureDeployments(
  deps: AzureSettingsHandlerDependencies,
  target: AzureDeploymentTarget,
  normalizedProjectId: string,
  deployments: AzureSettingsState["playgroundAzureDeployments"],
): void {
  const preferredSelection = deps.readPreferredAzureSelection();
  const preferredDeploymentName =
    preferredSelection &&
    preferredSelection.tenantId === deps.options.readActiveAzureTenantId() &&
    preferredSelection.principalId ===
      deps.options.readActiveAzurePrincipalId() &&
    (target === "playground"
      ? preferredSelection.playground?.projectId === normalizedProjectId
      : preferredSelection.utility?.projectId === normalizedProjectId)
      ? (
          target === "playground"
            ? preferredSelection.playground?.deploymentName
            : preferredSelection.utility?.deploymentName
        ) ?? ""
      : "";
  const currentState = deps.readState();

  deps.patchState(
    target === "playground"
      ? {
          isAzureAuthRequired: resolveAzureAuthRequiredState({
            currentAuthRequired: currentState.isAzureAuthRequired,
            nextAuthRequired: false,
            source: "background_success",
          }),
          playgroundAzureDeployments: deployments,
          selectedPlaygroundAzureDeploymentName: deployments.some(
            (deployment) =>
              deployment.name ===
              currentState.selectedPlaygroundAzureDeploymentName,
          )
            ? currentState.selectedPlaygroundAzureDeploymentName
            : preferredDeploymentName &&
                deployments.some(
                  (deployment) => deployment.name === preferredDeploymentName,
                )
              ? preferredDeploymentName
              : deployments[0]?.name ?? "",
          playgroundAzureDeploymentError:
            deployments.length === 0
              ? "No Agents SDK-compatible deployments found for this project."
              : null,
        }
      : {
          isAzureAuthRequired: resolveAzureAuthRequiredState({
            currentAuthRequired: currentState.isAzureAuthRequired,
            nextAuthRequired: false,
            source: "background_success",
          }),
          utilityAzureDeployments: deployments,
          selectedUtilityAzureDeploymentName: deployments.some(
            (deployment) =>
              deployment.name === currentState.selectedUtilityAzureDeploymentName,
          )
            ? currentState.selectedUtilityAzureDeploymentName
            : preferredDeploymentName &&
                deployments.some(
                  (deployment) => deployment.name === preferredDeploymentName,
                )
              ? preferredDeploymentName
              : deployments[0]?.name ?? "",
          utilityAzureDeploymentError:
            deployments.length === 0
              ? "No Agents SDK-compatible deployments found for this project."
              : null,
        },
  );
}
