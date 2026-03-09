import type {
  ChatApiResponse,
  ThreadOperationLogEntry,
} from "~/lib/client/chat/stream";
import { readChatEventStreamPayload } from "~/lib/client/chat/stream";
import { readJsonPayload } from "~/lib/client/infrastructure/api/http";
import type { ChatApiRequestPayload } from "~/lib/contracts/chat/request";

type ChatApiClientOptions = {
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  onProgress?: (message: string) => void;
  onOperationLogRecord?: (entry: ThreadOperationLogEntry) => void;
};

export type ChatApiClientResult = {
  response: Response;
  payload: ChatApiResponse;
  isEventStream: boolean;
  operationLogCount: number;
};

export class ChatApiClient {
  async sendMessage(
    payload: ChatApiRequestPayload,
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
  payload: ChatApiResponse;
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
    payload: await readJsonPayload<ChatApiResponse>(options.response, "chat"),
    isEventStream: false,
    operationLogCount: 0,
  };
}
