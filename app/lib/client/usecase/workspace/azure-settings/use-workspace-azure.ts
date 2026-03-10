import type {
  ReasoningEffort,
} from "~/lib/client/usecase/workspace/view-types";
import {
  filterReasoningEffortOptionsForDeploymentCompatibility,
  filterReasoningEffortOptionsForWebSearch,
  includesAzureDeploymentName,
  isWebSearchCompatibleReasoningEffort,
  resolveSupportedReasoningEffortOptions,
} from "./selectors";
import {
  useAzureSettings,
} from "./use-azure-settings";
import type {
  UseAzureSettingsOptions,
} from "./types";

type UseWorkspaceAzureOptions = UseAzureSettingsOptions & {
  reasoningEffort: ReasoningEffort;
  webSearchEnabled: boolean;
};

export function useWorkspaceAzure(
  options: UseWorkspaceAzureOptions,
) {
  const {
    reasoningEffort,
    webSearchEnabled,
    ...azureSettingsOptions
  } = options;
  const controller = useAzureSettings(azureSettingsOptions);

  const selectedPlaygroundAzureDeployment =
    controller.playgroundAzureDeployments.find(
      (deployment) =>
        deployment.name === controller.selectedPlaygroundAzureDeploymentName,
    );
  const selectedPlaygroundDeploymentReasoningEffortOptions =
    resolveSupportedReasoningEffortOptions(
      selectedPlaygroundAzureDeployment?.reasoningEffortOptions ?? [],
    );
  const selectedPlaygroundDeploymentCompatibleReasoningEffortOptions =
    filterReasoningEffortOptionsForDeploymentCompatibility(
      selectedPlaygroundDeploymentReasoningEffortOptions,
      controller.selectedPlaygroundAzureDeploymentName,
    );
  const isPlaygroundReasoningEffortSupported =
    selectedPlaygroundDeploymentCompatibleReasoningEffortOptions.length > 0;
  const effectivePlaygroundReasoningEffortOptions: ReasoningEffort[] =
    isPlaygroundReasoningEffortSupported
      ? filterReasoningEffortOptionsForWebSearch(
          selectedPlaygroundDeploymentCompatibleReasoningEffortOptions,
          webSearchEnabled,
        )
      : ["none"];
  const isSelectedPlaygroundReasoningEffortOptionAvailable =
    !isPlaygroundReasoningEffortSupported ||
    effectivePlaygroundReasoningEffortOptions.includes(reasoningEffort);
  const isPlaygroundReasoningEffortWebSearchCompatible =
    !webSearchEnabled ||
    !isPlaygroundReasoningEffortSupported ||
    isWebSearchCompatibleReasoningEffort(reasoningEffort);

  return {
    ...controller,
    effectivePlaygroundReasoningEffortOptions,
    isPlaygroundReasoningEffortSupported,
    selectedPlaygroundDeploymentCompatibleReasoningEffortOptions,
    isSelectedPlaygroundReasoningEffortOptionAvailable,
    isPlaygroundReasoningEffortWebSearchCompatible,
    isPlaygroundDeploymentAvailable(deploymentName: string): boolean {
      return includesAzureDeploymentName(
        controller.playgroundAzureDeployments,
        deploymentName,
      );
    },
    isUtilityDeploymentAvailable(deploymentName: string): boolean {
      return includesAzureDeploymentName(
        controller.utilityAzureDeployments,
        deploymentName,
      );
    },
    isPlaygroundReasoningEffortOptionAvailable(
      nextReasoningEffort: ReasoningEffort,
    ): boolean {
      return effectivePlaygroundReasoningEffortOptions.includes(
        nextReasoningEffort,
      );
    },
  };
}
