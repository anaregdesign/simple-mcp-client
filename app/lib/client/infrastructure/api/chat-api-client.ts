import type {
  ChatRunResponse,
  ThreadOperationLogEntry,
} from "~/lib/contracts/chat/operation-log";
import {
  parseSseDataBlock,
  readChatStreamEvent,
} from "~/lib/contracts/chat/operation-log";
import { readJsonPayload } from "~/lib/client/infrastructure/api/http";
import type { ChatRunRequest } from "~/lib/contracts/chat/request";

type ChatApiClientOptions = {
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  onProgress?: (message: string) => void;
  onOperationLogRecord?: (entry: ThreadOperationLogEntry) => void;
};

export type ChatApiClientResult = {
  response: Response;
  payload: ChatRunResponse;
  isEventStream: boolean;
  operationLogCount: number;
};

export class ChatApiClient {
  async sendMessage(
    payload: ChatRunRequest,
    options: ChatApiClientOptions = {},
  ): Promise<ChatApiClientResult> {
    const fetchImpl = options.fetchImpl ?? fetch;
    const response = await fetchImpl("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream, application/json",
      },
      signal: options.signal,
      body: JSON.stringify(payload),
    });

    const result = await consumeChatApiResponse({
      response,
      onProgress: options.onProgress,
      onOperationLogRecord: options.onOperationLogRecord,
    });

    return {
      response,
      ...result,
    };
  }
}

export const chatApiClient = new ChatApiClient();

export async function consumeChatApiResponse(options: {
  response: Response;
  onProgress?: (message: string) => void;
  onOperationLogRecord?: (entry: ThreadOperationLogEntry) => void;
}): Promise<{
  payload: ChatRunResponse;
  isEventStream: boolean;
  operationLogCount: number;
}> {
  const contentType = options.response.headers.get("content-type") ?? "";
  const isEventStream = contentType.toLowerCase().includes("text/event-stream");
  let operationLogCount = 0;
  const onProgress = options.onProgress ?? (() => {});
  const onOperationLogRecord =
    options.onOperationLogRecord ?? (() => {});

  if (isEventStream) {
    const payload = await readChatEventStreamPayload(options.response, {
      onProgress,
      onOperationLogRecord: (entry) => {
        operationLogCount += 1;
        onOperationLogRecord(entry);
      },
    });
    return {
      payload,
      isEventStream: true,
      operationLogCount,
    };
  }

  return {
    payload: await readJsonPayload<ChatRunResponse>(options.response, "chat"),
    isEventStream: false,
    operationLogCount: 0,
  };
}

async function readChatEventStreamPayload(
  response: Response,
  handlers: {
    onProgress: (message: string) => void;
    onOperationLogRecord: (entry: ThreadOperationLogEntry) => void;
  },
): Promise<ChatRunResponse> {
  if (!response.body) {
    return {
      error: "The server returned an empty stream.",
    };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalPayload: ChatRunResponse = {};

  const readChunk = (chunk: string) => {
    buffer += chunk;
    buffer = buffer.replace(/\r\n/g, "\n");

    let separatorIndex = buffer.indexOf("\n\n");
    while (separatorIndex >= 0) {
      const block = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);

      const data = parseSseDataBlock(block);
      if (data) {
        const event = readChatStreamEvent(data);
        if (event) {
          if (event.type === "progress") {
            handlers.onProgress(event.message);
          } else if (event.type === "operation_log") {
            handlers.onOperationLogRecord(event.record);
          } else if (event.type === "final") {
            finalPayload = {
              assistantMessage: event.assistantMessage,
              threadEnvironment: event.threadEnvironment,
            };
          } else if (event.type === "error") {
            finalPayload = {
              error: event.error,
              ...(event.errorCode ? { errorCode: event.errorCode } : {}),
            };
          }
        }
      }

      separatorIndex = buffer.indexOf("\n\n");
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    readChunk(decoder.decode(value, { stream: true }));
  }

  const tail = decoder.decode();
  if (tail) {
    readChunk(tail);
  }

  return finalPayload.assistantMessage || finalPayload.error
    ? finalPayload
    : { error: "The server returned an empty stream response." };
}
