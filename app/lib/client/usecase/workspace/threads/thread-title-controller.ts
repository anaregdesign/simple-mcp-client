import type {
  ThreadTitleApiResponse,
  ThreadTitleSuggestionRequest,
} from "~/lib/client/infrastructure/api/thread-title-api-client";
import {
  refreshThreadTitleInBackground as refreshThreadTitleInBackgroundOperation,
  type RefreshThreadTitleOptions,
} from "~/lib/client/usecase/workspace/threads/thread-title-operations";
import type {
  AzureConnectionView,
  ReasoningEffort,
} from "~/lib/client/usecase/workspace/view-types";
import type { ThreadState } from "~/lib/client/usecase/workspace/threads/thread-state";

type CreateThreadTitleControllerOptions = {
  readThreadById: (threadId: string) => ThreadState | undefined;
  readActiveThreadId: () => string;
  readActiveThreadNameInput: () => string;
  readActiveAzureTenantId: () => string;
  isArchivedThread: (threadIdRaw: string) => boolean;
  isChatLocked: boolean;
  isLoadingUtilityAzureDeployments: boolean;
  readActiveUtilityAzureConnection: () => AzureConnectionView | null;
  readSelectedUtilityAzureDeploymentName: () => string;
  isSelectedUtilityDeploymentAvailable: (deploymentName: string) => boolean;
  readAgentInstruction: () => string;
  isUtilityReasoningEffortSupported: boolean;
  readEffectiveUtilityReasoningEffort: () => ReasoningEffort;
  generateTitle: (
    request: ThreadTitleSuggestionRequest,
  ) => Promise<ThreadTitleApiResponse>;
  updateThreadStateById: (
    threadId: string,
    updater: (current: ThreadState) => ThreadState,
  ) => void;
  setActiveThreadNameInput: (value: string) => void;
  saveActiveThreadNameInBackground: (
    threadId: string,
    name: string,
  ) => Promise<void>;
  isSwitchingAzureTenant: boolean;
  reportAzureTenantSwitchPending: () => void;
  logClientError: (
    eventName: string,
    error: unknown,
    options?: {
      category?: string;
      location?: string;
      action?: string;
      statusCode?: number;
      context?: Record<string, unknown>;
    },
  ) => void;
};

export function createThreadTitleController(
  options: CreateThreadTitleControllerOptions,
) {
  function buildOperationDeps() {
    return {
      isArchivedThread: options.isArchivedThread,
      isChatLocked: options.isChatLocked,
      isLoadingUtilityAzureDeployments:
        options.isLoadingUtilityAzureDeployments,
      readActiveUtilityAzureConnection: options.readActiveUtilityAzureConnection,
      readSelectedUtilityAzureDeploymentName:
        options.readSelectedUtilityAzureDeploymentName,
      isSelectedUtilityDeploymentAvailable:
        options.isSelectedUtilityDeploymentAvailable,
      readThreadById: options.readThreadById,
      readActiveThreadId: options.readActiveThreadId,
      readActiveThreadNameInput: options.readActiveThreadNameInput,
      readAgentInstruction: options.readAgentInstruction,
      readActiveAzureTenantId: options.readActiveAzureTenantId,
      isUtilityReasoningEffortSupported:
        options.isUtilityReasoningEffortSupported,
      readEffectiveUtilityReasoningEffort:
        options.readEffectiveUtilityReasoningEffort,
      generateTitle: options.generateTitle,
      updateThreadStateById: options.updateThreadStateById,
      setActiveThreadNameInput: options.setActiveThreadNameInput,
      saveActiveThreadNameInBackground:
        options.saveActiveThreadNameInBackground,
      isSwitchingAzureTenant: options.isSwitchingAzureTenant,
      reportAzureTenantSwitchPending: options.reportAzureTenantSwitchPending,
      logClientError: options.logClientError,
    };
  }

  return {
    async refreshThreadTitleInBackground(
      refreshOptions: RefreshThreadTitleOptions,
    ): Promise<void> {
      await refreshThreadTitleInBackgroundOperation(
        buildOperationDeps(),
        refreshOptions,
      );
    },
  };
}
