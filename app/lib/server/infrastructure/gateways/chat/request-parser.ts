/**
 * Server chat request parser module.
 */
export type ParsedChatRequest = {
  threadId: string;
  turnId: string;
};

export type ChatRequestValidationErrorCode =
  | "invalid_json_body"
  | "invalid_thread_id"
  | "invalid_turn_id";

export type ChatRequestValidationError = {
  code: ChatRequestValidationErrorCode;
  eventName: string;
  message: string;
  statusCode: 400 | 422;
};

export type ChatRequestParseResult =
  | { ok: true; value: ParsedChatRequest }
  | { ok: false; error: ChatRequestValidationError };

export async function parseChatRequest(
  request: Request,
): Promise<ChatRequestParseResult> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return {
      ok: false,
      error: {
        code: "invalid_json_body",
        eventName: "invalid_json_body",
        message: "Invalid JSON body.",
        statusCode: 400,
      },
    };
  }

  return parseChatRequestPayload(payload);
}

export function parseChatRequestPayload(
  payload: unknown,
): ChatRequestParseResult {
  if (!isRecord(payload)) {
    return failure("invalid_thread_id", "`threadId` is required.");
  }

  const threadId = readTrimmedString(payload.threadId);
  if (!threadId) {
    return failure("invalid_thread_id", "`threadId` is required.");
  }

  const turnId = readTrimmedString(payload.turnId);
  if (!turnId) {
    return failure("invalid_turn_id", "`turnId` is required.");
  }

  return {
    ok: true,
    value: {
      threadId,
      turnId,
    },
  };
}

function failure(
  code: Exclude<ChatRequestValidationErrorCode, "invalid_json_body">,
  message: string,
): ChatRequestParseResult {
  return {
    ok: false,
    error: {
      code,
      eventName: code,
      message,
      statusCode: 422,
    },
  };
}

function readTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
