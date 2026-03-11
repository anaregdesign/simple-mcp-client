import type { ChatApiClientResult } from "~/lib/client/infrastructure/api/chat-api-client";
import type { ChatRunRequest } from "~/lib/contracts/chat/request";
import type { ThreadOperationLogEntry } from "~/lib/contracts/chat/operation-log";
import type { ThreadMessage } from "~/lib/contracts/chat/messages";
import type { ThreadEnvironment } from "~/lib/domain/value-objects/thread-environment";

export type SendMessageTransportResult = {
  assistantMessage: ThreadMessage;
  threadEnvironment: ThreadEnvironment;
  operationLogCount: number;
  usedEventStream: boolean;
};

export async function executeSendMessageTransport(
  deps: {
    sendMessage: (
      payload: ChatRunRequest,
      options: {
        signal: AbortSignal;
        onProgress: (message: string) => void;
        onOperationLogRecord: (entry: ThreadOperationLogEntry) => void;
      },
    ) => Promise<ChatApiClientResult>;
    markAzureAuthRequired: () => void;
  },
  options: {
    requestPayload: ChatRunRequest;
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

  if (!payload.assistantMessage) {
    throw new Error("The server returned an empty message.");
  }

  return {
    assistantMessage: payload.assistantMessage,
    threadEnvironment:
      "threadEnvironment" in payload && payload.threadEnvironment
        ? payload.threadEnvironment
        : options.requestThreadEnvironment,
    operationLogCount,
    usedEventStream: isEventStream,
  };
}
