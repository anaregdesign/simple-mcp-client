import { createThreadMessage, type ThreadMessage } from "~/lib/client/chat/messages";
import type { DraftChatAttachment } from "~/lib/client/chat/attachments";
import type { ThreadOperationLogEntry } from "~/lib/client/chat/stream";
import {
  isWebSearchCompatibleReasoningEffort,
} from "~/lib/client/usecase/workspace/azure-settings/selectors";
import {
  applySendResult,
  executeSendMessageTransport,
  prepareSendMessageExecution,
  type SendMessageTransportResult,
  validateSendPreconditions,
} from "~/lib/client/usecase/workspace/send-message-usecase";
import { isThreadPhaseBlockingSend } from "~/lib/client/usecase/workspace/thread-guards";
import type { ThreadOperationPhase } from "~/lib/client/usecase/workspace/thread-operation-phase";
import type { ThreadRequestState } from "~/lib/client/usecase/workspace/types";
import type {
  AzureConnectionView,
  MainViewTab,
  ReasoningEffort,
} from "~/lib/client/usecase/workspace/view-types";
import type { McpServerConfig } from "~/lib/contracts/mcp/profile";
import type { ThreadSkillActivation } from "~/lib/contracts/skills/types";
import type { ThreadEnvironment } from "~/lib/contracts/threads/environment";
import type { ThreadInstructionContextToggles } from "~/lib/contracts/threads/instruction-context";
import type { ThreadState } from "~/lib/contracts/threads/types";

type SendMessageLogOptions = {
  category?: string;
  location?: string;
  action?: string;
  statusCode?: number;
  context?: Record<string, unknown>;
};

type SendMessageOperationDependencies = {
  readActiveThreadId: () => string;
  readDraft: () => string;
  readSelectedPlaygroundAzureDeploymentName: () => string;
  isArchivedThread: (threadIdRaw: string) => boolean;
  readThreadRequestState: (threadId: string) => ThreadRequestState;
  readThreadOperationPhase: () => ThreadOperationPhase;
  isChatLocked: boolean;
  readActivePlaygroundAzureConnection: () => AzureConnectionView | null;
  isAzureAuthRequired: boolean;
  isLoadingPlaygroundAzureDeployments: boolean;
  isSelectedPlaygroundDeploymentAvailable: (deploymentName: string) => boolean;
  isPlaygroundReasoningEffortSupported: boolean;
  isSelectedPlaygroundReasoningEffortOptionAvailable: (
    reasoningEffort: ReasoningEffort,
  ) => boolean;
  readReasoningEffort: () => ReasoningEffort;
  readWebSearchEnabled: () => boolean;
  readBaseThread: (threadId: string) => ThreadState | null;
  readDraftAttachments: () => DraftChatAttachment[];
  readMessages: () => ThreadMessage[];
  readMcpServers: () => McpServerConfig[];
  readSelectedMessageSkillActivations: () => ThreadSkillActivation[];
  readSelectedThreadSkills: () => ThreadSkillActivation[];
  readAgentInstruction: () => string;
  readInstructionContextToggles: () => ThreadInstructionContextToggles;
  readActiveAzureTenantId: () => string;
  createTurnId: () => string;
  setThreadError: (value: string | null) => void;
  setUiError: (value: string | null) => void;
  setActiveMainTab: (tab: MainViewTab) => void;
  appendMessageToThreadState: (threadId: string, message: ThreadMessage) => void;
  setDraft: (value: string) => void;
  setSelectedMessageSkillActivations: (value: ThreadSkillActivation[]) => void;
  setDraftAttachments: (value: DraftChatAttachment[]) => void;
  setChatAttachmentError: (value: string | null) => void;
  setSystemNotice: (value: string | null) => void;
  clearAzureSessionStatus: () => void;
  updateThreadRequestState: (
    threadId: string,
    updater: (current: ThreadRequestState) => ThreadRequestState,
  ) => void;
  logClientInfo: (
    eventName: string,
    message: string,
    options?: SendMessageLogOptions,
  ) => void;
  logClientError: (
    eventName: string,
    error: unknown,
    options?: SendMessageLogOptions,
  ) => void;
  refreshThreadTitleInBackground: (options: {
    threadId: string;
    reason: "first_message";
  }) => Promise<void> | void;
  assignThreadSendAbortController: (
    threadId: string,
    controller: AbortController,
  ) => void;
  sendMessageTransport: (options: {
    requestPayload: ReturnType<typeof prepareSendMessageExecution>["requestPayload"];
    requestThreadEnvironment: ThreadEnvironment;
    signal: AbortSignal;
    onProgress: (message: string) => void;
    onOperationLogRecord: (entry: ThreadOperationLogEntry) => void;
  }) => Promise<SendMessageTransportResult>;
  appendThreadProgressMessage: (threadId: string, message: string) => void;
  appendThreadOperationLogToThreadState: (
    threadId: string,
    entry: ThreadOperationLogEntry,
  ) => void;
  applyThreadEnvironmentToThreadState: (
    threadId: string,
    environment: ThreadEnvironment,
  ) => void;
  clearThreadSendAbortController: (
    threadId: string,
    controller: AbortController,
  ) => void;
  scheduleThreadStateSave: (threadId: string) => void;
};

export async function sendMessage(
  deps: SendMessageOperationDependencies,
): Promise<void> {
  const threadId = deps.readActiveThreadId().trim();
  const content = deps.readDraft().trim();
  const deploymentName = deps.readSelectedPlaygroundAzureDeploymentName().trim();
  const reasoningEffort = deps.readReasoningEffort();
  const webSearchEnabled = deps.readWebSearchEnabled();
  const activePlaygroundAzureConnection =
    deps.readActivePlaygroundAzureConnection();
  const preconditionViolation = validateSendPreconditions({
    content,
    threadId,
    isArchivedThread: deps.isArchivedThread(threadId),
    isThreadSending: deps.readThreadRequestState(threadId).isSending,
    isThreadPhaseBlockingSend: isThreadPhaseBlockingSend(
      deps.readThreadOperationPhase(),
    ),
    isChatLocked: deps.isChatLocked,
    hasActivePlaygroundAzureConnection: !!activePlaygroundAzureConnection,
    isAzureAuthRequired: deps.isAzureAuthRequired,
    isLoadingPlaygroundAzureDeployments: deps.isLoadingPlaygroundAzureDeployments,
    deploymentName,
    isSelectedDeploymentValid:
      deps.isSelectedPlaygroundDeploymentAvailable(deploymentName),
    isPlaygroundReasoningEffortSupported:
      deps.isPlaygroundReasoningEffortSupported,
    isSelectedPlaygroundReasoningEffortOptionAvailable:
      deps.isSelectedPlaygroundReasoningEffortOptionAvailable(reasoningEffort),
    webSearchEnabled,
    isPlaygroundReasoningEffortWebSearchCompatible:
      !webSearchEnabled ||
      !deps.isPlaygroundReasoningEffortSupported ||
      isWebSearchCompatibleReasoningEffort(reasoningEffort),
  });
  if (preconditionViolation) {
    if (
      preconditionViolation.type === "thread_error" &&
      preconditionViolation.message
    ) {
      deps.setThreadError(preconditionViolation.message);
    }
    if (preconditionViolation.type === "ui_error") {
      deps.setUiError(preconditionViolation.message);
    }
    if (preconditionViolation.targetTab) {
      deps.setActiveMainTab(preconditionViolation.targetTab);
    }
    return;
  }

  if (
    !content ||
    !threadId ||
    !activePlaygroundAzureConnection ||
    !deploymentName
  ) {
    return;
  }

  const turnId = deps.createTurnId();
  const preparedSend = prepareSendMessageExecution({
    threadId,
    turnId,
    content,
    draftAttachments: deps.readDraftAttachments(),
    messages: deps.readMessages(),
    mcpServers: deps.readMcpServers(),
    selectedMessageSkillActivations: deps.readSelectedMessageSkillActivations(),
    selectedThreadSkills: deps.readSelectedThreadSkills(),
    baseThread: deps.readBaseThread(threadId),
    agentInstruction: deps.readAgentInstruction(),
    instructionContextToggles: deps.readInstructionContextToggles(),
    activeAzureTenantId: deps.readActiveAzureTenantId(),
    activePlaygroundAzureConnection,
    deploymentName,
    isPlaygroundReasoningEffortSupported:
      deps.isPlaygroundReasoningEffortSupported,
    reasoningEffort,
    webSearchEnabled,
  });

  deps.appendMessageToThreadState(threadId, preparedSend.userMessage);
  deps.setDraft("");
  deps.setSelectedMessageSkillActivations([]);
  deps.setDraftAttachments([]);
  deps.setChatAttachmentError(null);
  deps.setUiError(null);
  deps.setSystemNotice(null);
  deps.clearAzureSessionStatus();
  deps.updateThreadRequestState(threadId, (current) =>
    applySendResult(current, {
      status: "optimistic",
      turnId,
    }),
  );
  deps.logClientInfo("send_message_started", "Thread message request started.", {
    action: "send_message",
    context: {
      threadId,
      turnId,
      messageLength: content.length,
      historyCount: preparedSend.requestPayload.history.length,
      attachmentCount: preparedSend.requestPayload.attachments.length,
      mcpServerCount: preparedSend.requestMcpServers.length,
      skillSelectionCount: preparedSend.requestSkillSelections.length,
    },
  });
  if (preparedSend.shouldRefreshThreadTitleOnFirstMessage) {
    void deps.refreshThreadTitleInBackground({
      threadId,
      reason: "first_message",
    });
  }

  const sendAbortController = new AbortController();
  deps.assignThreadSendAbortController(threadId, sendAbortController);

  try {
    const transportResult = await deps.sendMessageTransport({
      requestPayload: preparedSend.requestPayload,
      requestThreadEnvironment: preparedSend.requestThreadEnvironment,
      signal: sendAbortController.signal,
      onProgress: (message) => {
        deps.appendThreadProgressMessage(threadId, message);
      },
      onOperationLogRecord: (entry) => {
        deps.appendThreadOperationLogToThreadState(threadId, {
          ...entry,
          turnId,
        });
      },
    });

    deps.applyThreadEnvironmentToThreadState(
      threadId,
      transportResult.threadEnvironment,
    );
    deps.appendMessageToThreadState(
      threadId,
      createThreadMessage(
        "assistant",
        transportResult.assistantMessage,
        turnId,
      ),
    );
    deps.updateThreadRequestState(threadId, (current) =>
      applySendResult(current, {
        status: "succeeded",
      }),
    );
    deps.logClientInfo(
      "send_message_succeeded",
      "Thread message request completed.",
      {
        action: "send_message",
        context: {
          threadId,
          turnId,
          responseLength: transportResult.assistantMessage.length,
          operationLogCount: transportResult.operationLogCount,
          usedEventStream: transportResult.usedEventStream,
        },
      },
    );
  } catch (sendError) {
    if (sendAbortController.signal.aborted) {
      deps.logClientInfo(
        "send_message_canceled",
        "Thread message request canceled.",
        {
          action: "send_message_cancel",
          context: {
            threadId,
            turnId,
          },
        },
      );
      deps.updateThreadRequestState(threadId, (current) =>
        applySendResult(current, {
          status: "canceled",
        }),
      );
      return;
    }

    deps.logClientError("send_message_failed", sendError, {
      action: "send_message",
      context: {
        threadId,
        turnId,
        messageLength: content.length,
        attachmentCount: preparedSend.requestPayload.attachments.length,
        skillSelectionCount: preparedSend.requestSkillSelections.length,
      },
    });
    deps.updateThreadRequestState(threadId, (current) =>
      applySendResult(current, {
        status: "failed",
        turnId,
        error: sendError,
      }),
    );
  } finally {
    deps.clearThreadSendAbortController(threadId, sendAbortController);
    deps.scheduleThreadStateSave(threadId);
  }
}
