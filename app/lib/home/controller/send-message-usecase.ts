/**
 * Home controller send-message use-case helpers.
 */
import type { ChatApiResponse, ThreadOperationLogEntry } from "~/lib/home/chat/stream";
import type { ThreadRequestState } from "~/lib/home/controller/types";
import type { ThreadInstructionContextToggles } from "~/lib/home/thread/instruction-context";
import type { ThreadEnvironment } from "~/lib/home/thread/environment";
import type { ThreadSkillActivation } from "~/lib/home/skills/types";
import type { ReasoningEffort } from "~/lib/home/shared/view-types";
import type { ChatRequestMcpServer } from "~/lib/home/controller/mcp-runtime";

export type HomeApiChatAttachment = {
  name: string;
  mimeType: string;
  dataUrl: string;
  sizeBytes: number;
};

export type HomeApiChatHistoryEntry = {
  role: "user" | "assistant";
  content: string;
  attachments?: HomeApiChatAttachment[];
};

export type HomeApiChatRequestPayload = {
  threadId: string;
  turnId: string;
  message: string;
  attachments: HomeApiChatAttachment[];
  history: HomeApiChatHistoryEntry[];
  azureConfig: {
    tenantId: string;
    projectName: string;
    baseUrl: string;
    apiVersion: string;
    deploymentName: string;
  };
  supportsReasoningEffort: boolean;
  webSearchEnabled: boolean;
  agentInstruction: string;
  instructionContextToggles: ThreadInstructionContextToggles;
  threadEnvironment: ThreadEnvironment;
  skills: ThreadSkillActivation[];
  explicitSkillLocations: string[];
  mcpServers: ChatRequestMcpServer[];
  reasoningEffort?: ReasoningEffort;
};

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
  options: Omit<HomeApiChatRequestPayload, "reasoningEffort"> & {
    reasoningEffort: ReasoningEffort;
  },
): HomeApiChatRequestPayload {
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

export async function consumeChatResponseStream(options: {
  response: Response;
  readChatEventStreamPayload: (
    response: Response,
    handlers: {
      onProgress: (message: string) => void;
      onOperationLogRecord: (entry: ThreadOperationLogEntry) => void;
    },
  ) => Promise<ChatApiResponse>;
  readJsonPayload: (response: Response) => Promise<ChatApiResponse>;
  onProgress: (message: string) => void;
  onOperationLogRecord: (entry: ThreadOperationLogEntry) => void;
}): Promise<{
  payload: ChatApiResponse;
  isEventStream: boolean;
  operationLogCount: number;
}> {
  const contentType = options.response.headers.get("content-type") ?? "";
  const isEventStream = contentType.toLowerCase().includes("text/event-stream");
  let operationLogCount = 0;

  if (isEventStream) {
    const payload = await options.readChatEventStreamPayload(options.response, {
      onProgress: options.onProgress,
      onOperationLogRecord: (entry) => {
        operationLogCount += 1;
        options.onOperationLogRecord(entry);
      },
    });
    return {
      payload,
      isEventStream,
      operationLogCount,
    };
  }

  const payload = await options.readJsonPayload(options.response);
  return {
    payload,
    isEventStream: false,
    operationLogCount: 0,
  };
}

function mapSendError(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Could not reach the server.";
}
