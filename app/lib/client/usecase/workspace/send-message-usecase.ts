/**
 * Client controller send-message use-case helpers.
 */
import type { ChatApiClientResult } from "~/lib/client/infrastructure/api/chat-api-client";
import { createThreadMessage } from "~/lib/client/usecase/workspace/chat-session/messages";
import { serializeMcpServersForChatRequest } from "~/lib/client/usecase/workspace/mcp-runtime";
import { mergeSkillSelections } from "~/lib/client/usecase/workspace/thread-runtime";
import type { DraftChatAttachment } from "~/lib/contracts/chat/attachments";
import type { ThreadMessage } from "~/lib/contracts/chat/messages";
import type { ThreadOperationLogEntry } from "~/lib/contracts/chat/operation-log";
import type { ChatApiRequestPayload } from "~/lib/contracts/chat/request";
import type { McpServerConfig } from "~/lib/contracts/mcp/profile";
import type { ThreadSkillActivation } from "~/lib/contracts/skills/types";
import {
  cloneThreadEnvironment,
  type ThreadEnvironment,
} from "~/lib/contracts/threads/environment";
import type { ThreadInstructionContextToggles } from "~/lib/contracts/threads/instruction-context";
import {
  cloneMcpServers,
  cloneThreadInstructionContexts,
  cloneThreadSkillActivations,
} from "~/lib/contracts/threads/state";
import type { ThreadState } from "~/lib/contracts/threads/types";
import type { ThreadRequestState } from "~/lib/client/usecase/workspace/types";
import type {
  AzureConnectionView,
  ReasoningEffort,
} from "~/lib/client/usecase/workspace/view-types";

export type SendPreconditionViolation = {
  type: "thread_error" | "ui_error";
  message: string;
  targetTab?: "threads" | "settings";
};

export function validateSendPreconditions(options: {
  content: string;
  threadId: string;
  isArchivedThread: boolean;
  isThreadSending: boolean;
  isThreadPhaseBlockingSend: boolean;
  isChatLocked: boolean;
  hasActivePlaygroundAzureConnection: boolean;
  isAzureAuthRequired: boolean;
  isLoadingPlaygroundAzureDeployments: boolean;
  deploymentName: string;
  isSelectedDeploymentValid: boolean;
  isPlaygroundReasoningEffortSupported: boolean;
  isSelectedPlaygroundReasoningEffortOptionAvailable: boolean;
  webSearchEnabled: boolean;
  isPlaygroundReasoningEffortWebSearchCompatible: boolean;
}): SendPreconditionViolation | null {
  if (!options.content) {
    return null;
  }

  if (!options.threadId) {
    return {
      type: "thread_error",
      targetTab: "threads",
      message: "Select or create a thread before sending.",
    };
  }

  if (options.isArchivedThread) {
    return {
      type: "thread_error",
      targetTab: "threads",
      message: "Archived thread is read-only. Restore it from Archives to continue.",
    };
  }

  if (options.isThreadSending) {
    return {
      type: "thread_error",
      message: "",
    };
  }

  if (options.isThreadPhaseBlockingSend) {
    return {
      type: "thread_error",
      targetTab: "threads",
      message: "Thread state is updating. Please wait.",
    };
  }

  if (options.isChatLocked) {
    return {
      type: "ui_error",
      targetTab: "settings",
      message: "Playground is unavailable while logged out. Open ⚙️ Settings and sign in.",
    };
  }

  if (!options.hasActivePlaygroundAzureConnection) {
    return {
      type: "ui_error",
      message: options.isAzureAuthRequired
        ? "Azure login is required. Click Project or Deployment and sign in."
        : "No Azure project is available. Check your Azure account permissions.",
    };
  }

  if (options.isLoadingPlaygroundAzureDeployments) {
    return {
      type: "ui_error",
      message: "Deployment list is loading. Please wait.",
    };
  }

  if (!options.deploymentName || !options.isSelectedDeploymentValid) {
    return {
      type: "ui_error",
      message: "Select an Azure deployment before sending.",
    };
  }

  if (
    options.isPlaygroundReasoningEffortSupported &&
    !options.isSelectedPlaygroundReasoningEffortOptionAvailable
  ) {
    return {
      type: "ui_error",
      message: "Select a Reasoning Effort value available for the selected deployment before sending.",
    };
  }

  if (
    options.webSearchEnabled &&
    options.isPlaygroundReasoningEffortSupported &&
    !options.isPlaygroundReasoningEffortWebSearchCompatible
  ) {
    return {
      type: "ui_error",
      message:
        "Selected Reasoning Effort cannot be used with Web Search. Choose a Web Search-compatible value.",
    };
  }

  return null;
}

export function buildChatRequestPayload(
  options: Omit<ChatApiRequestPayload, "reasoningEffort"> & {
    reasoningEffort: ReasoningEffort;
  },
): ChatApiRequestPayload {
  return {
    threadId: options.threadId,
    turnId: options.turnId,
    message: options.message,
    attachments: options.attachments,
    history: options.history,
    azureConfig: options.azureConfig,
    supportsReasoningEffort: options.supportsReasoningEffort,
    ...(options.supportsReasoningEffort
      ? {
          reasoningEffort: options.reasoningEffort,
        }
      : {}),
    webSearchEnabled: options.webSearchEnabled,
    agentInstruction: options.agentInstruction,
    instructionContextToggles: options.instructionContextToggles,
    threadEnvironment: options.threadEnvironment,
    skills: options.skills,
    explicitSkillLocations: options.explicitSkillLocations,
    mcpServers: options.mcpServers,
  };
}

export type PreparedSendMessageExecution = {
  userMessage: ThreadMessage;
  requestThreadEnvironment: ThreadEnvironment;
  requestPayload: ChatApiRequestPayload;
  requestMcpServers: McpServerConfig[];
  requestSkillSelections: ThreadSkillActivation[];
  shouldRefreshThreadTitleOnFirstMessage: boolean;
};

export function prepareSendMessageExecution(options: {
  threadId: string;
  turnId: string;
  content: string;
  draftAttachments: DraftChatAttachment[];
  messages: ThreadMessage[];
  mcpServers: McpServerConfig[];
  selectedMessageSkillActivations: ThreadSkillActivation[];
  selectedThreadSkills: ThreadSkillActivation[];
  baseThread: ThreadState | null;
  agentInstruction: string;
  instructionContextToggles: ThreadInstructionContextToggles;
  activeAzureTenantId: string;
  activePlaygroundAzureConnection: AzureConnectionView;
  deploymentName: string;
  isPlaygroundReasoningEffortSupported: boolean;
  reasoningEffort: ReasoningEffort;
  webSearchEnabled: boolean;
}): PreparedSendMessageExecution {
  const requestAttachments = options.draftAttachments.map(
    ({ id: _id, ...attachment }) => attachment,
  );
  const requestMcpServers = cloneMcpServers(options.mcpServers);
  const requestMessageSkillActivations = cloneThreadSkillActivations(
    options.selectedMessageSkillActivations,
  );
  const requestSkillSelections = mergeSkillSelections(
    options.selectedThreadSkills,
    requestMessageSkillActivations,
  );
  const requestThreadEnvironment = options.baseThread
    ? cloneThreadEnvironment(options.baseThread.threadEnvironment)
    : {};
  const requestExplicitSkillLocations = requestSkillSelections.map(
    (selection) => selection.location,
  );
  const requestInstructionContextToggles = cloneThreadInstructionContexts(
    options.instructionContextToggles,
  );
  const userMessage = createThreadMessage(
    "user",
    options.content,
    options.turnId,
    requestAttachments,
    requestMessageSkillActivations,
  );
  const history = options.messages.map(
    ({ role, content: previousContent, attachments }) => {
      if (role === "user" && attachments.length > 0) {
        return {
          role,
          content: previousContent,
          attachments,
        };
      }

      return {
        role,
        content: previousContent,
      };
    },
  );

  return {
    userMessage,
    requestThreadEnvironment,
    requestPayload: buildChatRequestPayload({
      threadId: options.threadId,
      turnId: options.turnId,
      message: options.content,
      attachments: requestAttachments,
      history,
      azureConfig: {
        tenantId: options.activeAzureTenantId,
        projectName: options.activePlaygroundAzureConnection.projectName,
        baseUrl: options.activePlaygroundAzureConnection.baseUrl,
        apiVersion: options.activePlaygroundAzureConnection.apiVersion,
        deploymentName: options.deploymentName,
      },
      supportsReasoningEffort: options.isPlaygroundReasoningEffortSupported,
      reasoningEffort: options.reasoningEffort,
      webSearchEnabled: options.webSearchEnabled,
      agentInstruction: options.agentInstruction,
      instructionContextToggles: requestInstructionContextToggles,
      threadEnvironment: requestThreadEnvironment,
      skills: requestSkillSelections,
      explicitSkillLocations: requestExplicitSkillLocations,
      mcpServers: serializeMcpServersForChatRequest(requestMcpServers),
    }),
    requestMcpServers,
    requestSkillSelections,
    shouldRefreshThreadTitleOnFirstMessage:
      options.baseThread !== null &&
      options.baseThread.deletedAt === null &&
      options.baseThread.messages.length === 0,
  };
}

export type SendMessageTransportResult = {
  assistantMessage: string;
  threadEnvironment: ThreadEnvironment;
  operationLogCount: number;
  usedEventStream: boolean;
};

export async function executeSendMessageTransport(
  deps: {
    sendMessage: (
      payload: ChatApiRequestPayload,
      options: {
        signal: AbortSignal;
        onProgress: (message: string) => void;
        onOperationLogRecord: (entry: ThreadOperationLogEntry) => void;
      },
    ) => Promise<ChatApiClientResult>;
    markAzureAuthRequired: () => void;
  },
  options: {
    requestPayload: ChatApiRequestPayload;
    requestThreadEnvironment: ThreadEnvironment;
    signal: AbortSignal;
    onProgress: (message: string) => void;
    onOperationLogRecord: (entry: ThreadOperationLogEntry) => void;
  },
): Promise<SendMessageTransportResult> {
  const { response, payload, isEventStream, operationLogCount } =
    await deps.sendMessage(options.requestPayload, {
      signal: options.signal,
      onProgress: options.onProgress,
      onOperationLogRecord: options.onOperationLogRecord,
    });

  if (!response.ok || payload.error) {
    if (payload.errorCode === "azure_login_required") {
      deps.markAzureAuthRequired();
    }
    throw new Error(payload.error || "Failed to send message.");
  }

  if (!payload.message) {
    throw new Error("The server returned an empty message.");
  }

  return {
    assistantMessage: payload.message,
    threadEnvironment:
      "threadEnvironment" in payload && payload.threadEnvironment
        ? payload.threadEnvironment
        : options.requestThreadEnvironment,
    operationLogCount,
    usedEventStream: isEventStream,
  };
}

export function applySendResult(
  current: ThreadRequestState,
  options:
    | {
        status: "optimistic";
        turnId: string;
      }
    | {
        status: "succeeded";
      }
    | {
        status: "canceled";
      }
    | {
        status: "failed";
        turnId: string;
        error: unknown;
      },
): ThreadRequestState {
  if (options.status === "optimistic") {
    return {
      ...current,
      isSending: true,
      sendProgressMessages: ["Preparing request..."],
      activeTurnId: options.turnId,
      lastErrorTurnId: null,
      error: null,
    };
  }

  if (options.status === "succeeded" || options.status === "canceled") {
    return {
      ...current,
      isSending: false,
      sendProgressMessages: [],
      activeTurnId: null,
      lastErrorTurnId: null,
      error: null,
    };
  }

  return {
    ...current,
    isSending: false,
    sendProgressMessages: [],
    activeTurnId: null,
    lastErrorTurnId: options.turnId,
    error: mapSendError(options.error),
  };
}

function mapSendError(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Could not reach the server.";
}
