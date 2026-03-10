import { ClientApiError } from "~/lib/client/infrastructure/api/api-client";
import type {
  ThreadTitleApiResponse,
  ThreadTitleSuggestionRequest,
} from "~/lib/client/infrastructure/api/thread-title-api-client";
import type {
  AzureConnectionView,
  ReasoningEffort,
} from "~/lib/client/usecase/workspace/view-types";
import { hasThreadInteraction } from "~/lib/client/usecase/workspace/threads/thread-save-state";
import {
  buildThreadAutoTitlePlaygroundContent,
} from "~/lib/contracts/threads/title";
import { normalizeGeneratedThreadTitle } from "~/lib/domain/value-objects/thread-name";
import type { ThreadState } from "~/lib/client/usecase/workspace/threads/thread-state";
import {
  applyThreadNameChange,
  type ThreadNameMutationDependencies,
} from "~/lib/client/usecase/workspace/threads/thread-name-mutation";

type ThreadTitleLogOptions = {
  category?: string;
  location?: string;
  action?: string;
  statusCode?: number;
  context?: Record<string, unknown>;
};

type RefreshThreadTitleReason =
  | "first_message"
  | "instruction_update"
  | "utility_deployment_update";

export type RefreshThreadTitleOptions = {
  threadId: string;
  reason: RefreshThreadTitleReason;
  instructionOverride?: string;
};

type ThreadTitleOperationDependencies = ThreadNameMutationDependencies & {
  isArchivedThread: (threadIdRaw: string) => boolean;
  isChatLocked: boolean;
  isLoadingUtilityAzureDeployments: boolean;
  readActiveUtilityAzureConnection: () => AzureConnectionView | null;
  readSelectedUtilityAzureDeploymentName: () => string;
  isSelectedUtilityDeploymentAvailable: (deploymentName: string) => boolean;
  readThreadById: (threadId: string) => ThreadState | undefined;
  readActiveThreadId: () => string;
  readActiveThreadNameInput: () => string;
  readAgentInstruction: () => string;
  readActiveAzureTenantId: () => string;
  isUtilityReasoningEffortSupported: boolean;
  readEffectiveUtilityReasoningEffort: () => ReasoningEffort;
  generateTitle: (
    request: ThreadTitleSuggestionRequest,
  ) => Promise<ThreadTitleApiResponse>;
  saveActiveThreadNameInBackground: (
    threadId: string,
    name: string,
  ) => Promise<void>;
  isSwitchingAzureTenant: boolean;
  reportAzureTenantSwitchPending: () => void;
  logClientError: (
    eventName: string,
    error: unknown,
    options?: ThreadTitleLogOptions,
  ) => void;
};

export async function refreshThreadTitleInBackground(
  deps: ThreadTitleOperationDependencies,
  options: RefreshThreadTitleOptions,
): Promise<void> {
  const normalizedThreadId = options.threadId.trim();
  if (!normalizedThreadId) {
    return;
  }
  if (
    deps.isArchivedThread(normalizedThreadId) ||
    deps.isChatLocked ||
    deps.isLoadingUtilityAzureDeployments
  ) {
    return;
  }

  const utilityConnection = deps.readActiveUtilityAzureConnection();
  const deploymentName = deps.readSelectedUtilityAzureDeploymentName().trim();
  if (
    !utilityConnection ||
    !deploymentName ||
    !deps.isSelectedUtilityDeploymentAvailable(deploymentName)
  ) {
    return;
  }

  const baseThread = deps.readThreadById(normalizedThreadId);
  if (!baseThread || !hasThreadInteraction(baseThread)) {
    return;
  }

  const playgroundContent = buildThreadAutoTitlePlaygroundContent(
    baseThread.messages,
  );
  if (!playgroundContent) {
    return;
  }

  const instruction =
    typeof options.instructionOverride === "string"
      ? options.instructionOverride
      : normalizedThreadId === deps.readActiveThreadId().trim()
        ? deps.readAgentInstruction()
        : baseThread.agentInstruction;

  try {
    const payload = await deps.generateTitle({
      playgroundContent,
      instruction,
      azureConfig: {
        tenantId: deps.readActiveAzureTenantId(),
        projectName: utilityConnection.projectName,
        baseUrl: utilityConnection.baseUrl,
        apiVersion: utilityConnection.apiVersion,
        deploymentName,
      },
      supportsReasoningEffort: deps.isUtilityReasoningEffortSupported,
      ...(deps.isUtilityReasoningEffortSupported
        ? {
            reasoningEffort: deps.readEffectiveUtilityReasoningEffort(),
          }
        : {}),
    });

    const nextTitle = normalizeGeneratedThreadTitle(
      typeof payload.title === "string" ? payload.title : "",
    );
    if (!nextTitle) {
      return;
    }

    const latestThread = deps.readThreadById(normalizedThreadId);
    if (!latestThread || latestThread.deletedAt !== null) {
      return;
    }

    const activeThreadId = deps.readActiveThreadId().trim();
    const currentInputName =
      normalizedThreadId === activeThreadId
        ? deps.readActiveThreadNameInput().trim()
        : latestThread.name.trim();
    if (
      nextTitle === latestThread.name &&
      (!currentInputName || currentInputName === nextTitle)
    ) {
      return;
    }

    const renamedThread = applyThreadNameChange(deps, {
      threadId: normalizedThreadId,
      nextName: nextTitle,
    });
    if (!renamedThread) {
      return;
    }

    await deps.saveActiveThreadNameInBackground(
      renamedThread.id,
      renamedThread.name,
    );
  } catch (threadTitleError) {
    if (
      threadTitleError instanceof ClientApiError &&
      threadTitleError.kind === "auth_required"
    ) {
      if (
        options.reason === "utility_deployment_update" &&
        deps.isSwitchingAzureTenant
      ) {
        deps.reportAzureTenantSwitchPending();
      }
      return;
    }

    deps.logClientError("generate_thread_title_failed", threadTitleError, {
      action: "generate_thread_title",
      context: {
        threadId: normalizedThreadId,
        reason: options.reason,
      },
    });
  }
}
