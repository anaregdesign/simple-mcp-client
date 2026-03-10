import { copyTextToClipboard } from "~/lib/client/infrastructure/browser/clipboard";
import {
  isLikelyChatAzureAuthError,
} from "~/lib/client/usecase/workspace/azure-settings/errors";
import {
  filterReasoningEffortOptionsForWebSearch,
  isWebSearchCompatibleReasoningEffort,
} from "~/lib/client/usecase/workspace/azure-settings/selectors";
import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";
import type {
  MainViewTab,
} from "~/lib/client/usecase/workspace/view-types";

type PlaygroundControlHandlerDependencies = {
  isSending: boolean;
  isStartingAzureLogin: boolean;
  isSwitchingAzureTenant: boolean;
  isStartingAzureLogout: boolean;
  isLoadingAzureConnections: boolean;
  isLoadingPlaygroundAzureDeployments: boolean;
  isAzureAuthRequired: boolean;
  azureConnectionError: string | null;
  hasAzureConnections: boolean;
  hasActivePlaygroundAzureConnection: boolean;
  hasPlaygroundAzureDeployments: boolean;
  hasSelectedPlaygroundAzureDeploymentName: boolean;
  isPlaygroundReasoningEffortSupported: boolean;
  selectedPlaygroundDeploymentCompatibleReasoningEffortOptions: readonly ReasoningEffort[];
  effectivePlaygroundReasoningEffortOptions: readonly ReasoningEffort[];
  reasoningEffort: ReasoningEffort;
  setUiError: (value: string | null) => void;
  setSystemNotice: (value: string | null) => void;
  setActiveMainTab: (tab: MainViewTab) => void;
  setReasoningEffort: (value: ReasoningEffort) => void;
  setWebSearchEnabled: (value: boolean) => void;
  clearAzureSessionStatus: () => void;
  markAzureAuthRequired: () => void;
  handleAzureLogin: () => Promise<void> | void;
  handleSelectPlaygroundProject: (projectId: string) => void;
  handleSelectPlaygroundDeployment: (deploymentName: string) => void;
  loadAzureProjects: (options: { force?: boolean }) => Promise<unknown>;
};

export type PlaygroundControlHandlers = {
  handleChatProjectChange: (projectId: string) => void;
  handleChatDeploymentChange: (deploymentName: string) => void;
  handleReasoningEffortChange: (value: ReasoningEffort) => void;
  handleWebSearchEnabledChange: (value: boolean) => void;
  handleChatAzureSelectorAction: (target: "project" | "deployment") => void;
  handleCopyMessage: (content: string) => void;
  handleCopyMcpLog: (text: string) => void;
};

export function createPlaygroundControlHandlers(
  deps: PlaygroundControlHandlerDependencies,
): PlaygroundControlHandlers {
  return {
    handleChatProjectChange(projectId: string) {
      deps.handleSelectPlaygroundProject(projectId);
      deps.setUiError(null);
    },

    handleChatDeploymentChange(nextDeploymentNameRaw: string) {
      const nextDeploymentName = nextDeploymentNameRaw.trim();
      deps.handleSelectPlaygroundDeployment(nextDeploymentName);
      deps.setUiError(null);
    },

    handleReasoningEffortChange(nextValue: ReasoningEffort) {
      if (!deps.isPlaygroundReasoningEffortSupported) {
        return;
      }
      if (!deps.effectivePlaygroundReasoningEffortOptions.includes(nextValue)) {
        return;
      }

      deps.setReasoningEffort(nextValue);
      deps.setUiError(null);
    },

    handleWebSearchEnabledChange(nextValue: boolean) {
      if (
        nextValue &&
        deps.isPlaygroundReasoningEffortSupported &&
        filterReasoningEffortOptionsForWebSearch(
          deps.selectedPlaygroundDeploymentCompatibleReasoningEffortOptions,
          true,
        ).length === 0
      ) {
        deps.setUiError(
          "Web Search is not available for the selected deployment.",
        );
        return;
      }

      if (
        nextValue &&
        deps.isPlaygroundReasoningEffortSupported &&
        !isWebSearchCompatibleReasoningEffort(deps.reasoningEffort)
      ) {
        deps.setUiError(
          "Selected Reasoning Effort cannot be used with Web Search. Choose a compatible value first.",
        );
        return;
      }

      deps.setWebSearchEnabled(nextValue);
      deps.setUiError(null);
    },

    handleChatAzureSelectorAction(target: "project" | "deployment") {
      if (
        deps.isSending ||
        deps.isStartingAzureLogin ||
        deps.isSwitchingAzureTenant ||
        deps.isStartingAzureLogout ||
        deps.isLoadingAzureConnections ||
        deps.isLoadingPlaygroundAzureDeployments
      ) {
        return;
      }

      deps.setUiError(null);
      deps.setSystemNotice(null);
      deps.clearAzureSessionStatus();

      if (
        deps.isAzureAuthRequired ||
        isLikelyChatAzureAuthError(deps.azureConnectionError)
      ) {
        deps.markAzureAuthRequired();
        deps.setActiveMainTab("settings");
        void deps.handleAzureLogin();
        return;
      }

      const needsProjectReload =
        !deps.hasAzureConnections || !deps.hasActivePlaygroundAzureConnection;
      const needsDeploymentReload =
        target === "deployment" &&
        (!deps.hasActivePlaygroundAzureConnection ||
          !deps.hasPlaygroundAzureDeployments ||
          !deps.hasSelectedPlaygroundAzureDeploymentName);

      if (needsProjectReload || needsDeploymentReload) {
        void deps.loadAzureProjects({ force: true });
      }
    },

    handleCopyMessage(content: string) {
      void copyTextToClipboard(content).catch(() => {
        deps.setUiError("Failed to copy text to clipboard.");
      });
    },

    handleCopyMcpLog(text: string) {
      void copyTextToClipboard(text).catch(() => {
        deps.setUiError("Failed to copy MCP log to clipboard.");
      });
    },
  };
}
