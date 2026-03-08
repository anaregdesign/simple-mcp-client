/**
 * Client runtime support module.
 */
import {
  parseSseDataBlock,
  readChatStreamEvent,
  readThreadOperationLogEntryFromUnknown,
  type ChatApiResponse,
  type ThreadOperationLogEntry,
  upsertThreadOperationLogEntry,
} from "~/lib/contracts/chat/operation-log";

export {
  parseSseDataBlock,
  readChatStreamEvent,
  readThreadOperationLogEntryFromUnknown,
  upsertThreadOperationLogEntry,
};
export type { ChatApiResponse, ThreadOperationLogEntry };

export async function readChatEventStreamPayload(
  response: Response,
  handlers: {
    onProgress: (message: string) => void;
    onOperationLogRecord: (entry: ThreadOperationLogEntry) => void;
  },
): Promise<ChatApiResponse> {
  if (!response.body) {
    return {
      error: "The server returned an empty stream.",
    };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalPayload: ChatApiResponse = {};

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
              message: event.message,
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

  return finalPayload.message || finalPayload.error
    ? finalPayload
    : { error: "The server returned an empty stream response." };
}

export function appendProgressMessage(
  message: string,
  setMessages: (updater: (current: string[]) => string[]) => void,
): void {
  const trimmed = message.trim();
  if (!trimmed) {
    return;
  }

  setMessages((current) => {
    if (current[current.length - 1] === trimmed) {
      return current;
    }

    const next = [...current, trimmed];
    return next.slice(-8);
  });
}
