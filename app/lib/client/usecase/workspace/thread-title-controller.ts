import type { MutableRefObject } from "react";
import type {
  ThreadTitleApiResponse,
  ThreadTitleSuggestionRequest,
} from "~/lib/client/infrastructure/api/thread-title-api-client";
import {
  refreshThreadTitleInBackground as refreshThreadTitleInBackgroundOperation,
  type RefreshThreadTitleOptions,
} from "~/lib/client/usecase/workspace/thread-title-operations";
import {
  findThreadStateById,
} from "~/lib/client/usecase/workspace/thread-runtime";
import type {
  AzureConnectionView,
  ReasoningEffort,
} from "~/lib/client/usecase/workspace/view-types";
import type { ThreadState } from "~/lib/contracts/threads/types";

type CreateThreadTitleControllerOptions = {
  activeThreadIdRef: MutableRefObject<string>;
  activeThreadNameInputRef: MutableRefObject<string>;
  activeAzureTenantIdRef: MutableRefObject<string>;
  threadsRef: MutableRefObject<ThreadState[]>;
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
      readThreadById: (threadId: string) =>
        findThreadStateById(options.threadsRef.current, threadId) ?? undefined,
      readActiveThreadId: () => options.activeThreadIdRef.current,
      readActiveThreadNameInput: () => options.activeThreadNameInputRef.current,
      readAgentInstruction: options.readAgentInstruction,
      readActiveAzureTenantId: () => options.activeAzureTenantIdRef.current,
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
