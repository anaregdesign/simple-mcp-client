import type { MutableRefObject } from "react";
import { createRuntimeId } from "~/lib/client/usecase/workspace/runtime-id";
import {
  sendMessage as sendMessageOperation,
} from "~/lib/client/usecase/workspace/chat-session/operations";
import {
  executeSendMessageTransport,
} from "~/lib/client/usecase/workspace/chat-session/send-message-transport";
import {
  findThreadStateById,
} from "~/lib/client/usecase/workspace/threads/thread-runtime";
import type {
  ThreadOperationPhase,
} from "~/lib/client/usecase/workspace/threads/thread-operation-phase";
import type {
  ThreadRequestState,
} from "~/lib/client/usecase/workspace/threads/thread-request-state";
import type {
  AzureConnectionView,
  MainViewTab,
} from "~/lib/client/usecase/workspace/view-types";
import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";
import type { DraftChatAttachment } from "~/lib/contracts/chat/attachments";
import type { ThreadMessage } from "~/lib/contracts/chat/messages";
import type { ThreadOperationLogEntry } from "~/lib/contracts/chat/operation-log";
import type { McpServerConfig } from "~/lib/contracts/mcp/profile";
import type { ThreadSkillActivation } from "~/lib/contracts/skills/types";
import type { ThreadEnvironment } from "~/lib/domain/value-objects/thread-environment";
import type { ThreadInstructionContextToggles } from "~/lib/domain/value-objects/thread-instruction-context";
import type { ThreadState } from "~/lib/client/usecase/workspace/threads/thread-state";

type SendMessageLogOptions = {
  category?: string;
  location?: string;
  action?: string;
  statusCode?: number;
  context?: Record<string, unknown>;
};

type SendMessageGateway = Parameters<typeof executeSendMessageTransport>[0]["sendMessage"];
type SendMessageTransportOptions = Parameters<
  typeof executeSendMessageTransport
>[1];

type CreateSendMessageControllerOptions = {
  activeThreadIdRef: MutableRefObject<string>;
  activeAzureTenantIdRef: MutableRefObject<string>;
  threadsRef: MutableRefObject<ThreadState[]>;
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
  readDraftAttachments: () => DraftChatAttachment[];
  readMessages: () => ThreadMessage[];
  readMcpServers: () => McpServerConfig[];
  readSelectedMessageSkillActivations: () => ThreadSkillActivation[];
  readSelectedThreadSkills: () => ThreadSkillActivation[];
  readAgentInstruction: () => string;
  readInstructionContextToggles: () => ThreadInstructionContextToggles;
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
  saveThreadStateToDatabase: (
    thread: ThreadState,
  ) => Promise<boolean>;
  markAzureAuthRequired: () => void;
  sendMessage: SendMessageGateway;
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

export function createSendMessageController(
  options: CreateSendMessageControllerOptions,
) {
  function buildOperationDeps() {
    return {
      readActiveThreadId: () => options.activeThreadIdRef.current,
      readDraft: options.readDraft,
      readSelectedPlaygroundAzureDeploymentName:
        options.readSelectedPlaygroundAzureDeploymentName,
      isArchivedThread: options.isArchivedThread,
      readThreadRequestState: options.readThreadRequestState,
      readThreadOperationPhase: options.readThreadOperationPhase,
      isChatLocked: options.isChatLocked,
      readActivePlaygroundAzureConnection:
        options.readActivePlaygroundAzureConnection,
      isAzureAuthRequired: options.isAzureAuthRequired,
      isLoadingPlaygroundAzureDeployments:
        options.isLoadingPlaygroundAzureDeployments,
      isSelectedPlaygroundDeploymentAvailable:
        options.isSelectedPlaygroundDeploymentAvailable,
      isPlaygroundReasoningEffortSupported:
        options.isPlaygroundReasoningEffortSupported,
      isSelectedPlaygroundReasoningEffortOptionAvailable:
        options.isSelectedPlaygroundReasoningEffortOptionAvailable,
      readReasoningEffort: options.readReasoningEffort,
      readWebSearchEnabled: options.readWebSearchEnabled,
      readBaseThread: (threadId: string) =>
        findThreadStateById(options.threadsRef.current, threadId),
      readDraftAttachments: options.readDraftAttachments,
      readMessages: options.readMessages,
      readMcpServers: options.readMcpServers,
      readSelectedMessageSkillActivations:
        options.readSelectedMessageSkillActivations,
      readSelectedThreadSkills: options.readSelectedThreadSkills,
      readAgentInstruction: options.readAgentInstruction,
      readInstructionContextToggles: options.readInstructionContextToggles,
      readActiveAzureTenantId: () => options.activeAzureTenantIdRef.current,
      createTurnId: () => createRuntimeId("turn"),
      setThreadError: options.setThreadError,
      setUiError: options.setUiError,
      setActiveMainTab: options.setActiveMainTab,
      appendMessageToThreadState: options.appendMessageToThreadState,
      setDraft: options.setDraft,
      setSelectedMessageSkillActivations:
        options.setSelectedMessageSkillActivations,
      setDraftAttachments: options.setDraftAttachments,
      setChatAttachmentError: options.setChatAttachmentError,
      setSystemNotice: options.setSystemNotice,
      clearAzureSessionStatus: options.clearAzureSessionStatus,
      updateThreadRequestState: options.updateThreadRequestState,
      logClientInfo: options.logClientInfo,
      logClientError: options.logClientError,
      refreshThreadTitleInBackground: options.refreshThreadTitleInBackground,
      assignThreadSendAbortController:
        options.assignThreadSendAbortController,
      saveThreadStateToDatabase: options.saveThreadStateToDatabase,
      sendMessageTransport: (transportOptions: SendMessageTransportOptions) =>
        executeSendMessageTransport(
          {
            sendMessage: options.sendMessage,
            markAzureAuthRequired: options.markAzureAuthRequired,
          },
          transportOptions,
        ),
      appendThreadProgressMessage: options.appendThreadProgressMessage,
      appendThreadOperationLogToThreadState:
        options.appendThreadOperationLogToThreadState,
      applyThreadEnvironmentToThreadState:
        options.applyThreadEnvironmentToThreadState,
      clearThreadSendAbortController: options.clearThreadSendAbortController,
      scheduleThreadStateSave: options.scheduleThreadStateSave,
    };
  }

  return {
    async sendMessage(): Promise<void> {
      await sendMessageOperation(buildOperationDeps());
    },
  };
}
