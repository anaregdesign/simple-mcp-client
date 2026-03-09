import { DEFAULT_AGENT_INSTRUCTION } from "~/lib/constants/chat";
import { readThreadWritePayloadFromUnknown } from "~/lib/contracts/threads/parsers";
import type { ThreadWritePayload } from "~/lib/contracts/threads/types";
import { isThreadRestorePayload } from "~/lib/server/usecase/threads/thread-service";

export type ThreadRouteValidationIssue = {
  statusCode: 422;
  code:
    | "invalid_thread_id"
    | "invalid_thread_payload"
    | "thread_id_mismatch"
    | "invalid_restore_payload";
  error: string;
  eventName:
    | "invalid_thread_id_payload"
    | "invalid_thread_payload"
    | "thread_id_mismatch"
    | "invalid_restore_payload";
  action: "read_thread_id" | "read_thread_snapshot" | "validate_payload";
  message: string;
  context?: Record<string, unknown>;
};

export type ThreadRouteParseResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      issue: ThreadRouteValidationIssue;
    };

export function readThreadIdParam(value: unknown): ThreadRouteParseResult<string> {
  const threadId = typeof value === "string" ? value.trim() : "";
  if (threadId) {
    return {
      ok: true,
      value: threadId,
    };
  }

  return {
    ok: false,
    issue: {
      statusCode: 422,
      code: "invalid_thread_id",
      error: "Invalid thread id payload.",
      eventName: "invalid_thread_id_payload",
      action: "read_thread_id",
      message: "Invalid thread id payload.",
    },
  };
}

export function readThreadWritePayload(
  value: unknown,
): ThreadRouteParseResult<ThreadWritePayload> {
  const thread = readThreadWritePayloadFromUnknown(value, {
    fallbackInstruction: DEFAULT_AGENT_INSTRUCTION,
  });
  if (thread) {
    return {
      ok: true,
      value: thread,
    };
  }

  return {
    ok: false,
    issue: {
      statusCode: 422,
      code: "invalid_thread_payload",
      error: "Invalid thread payload.",
      eventName: "invalid_thread_payload",
      action: "read_thread_snapshot",
      message: "Invalid thread payload.",
    },
  };
}

export function ensureThreadPayloadMatchesPath(
  threadId: string,
  payloadThreadId: string,
): ThreadRouteValidationIssue | null {
  if (threadId === payloadThreadId) {
    return null;
  }

  return {
    statusCode: 422,
    code: "thread_id_mismatch",
    error: "`thread.id` must match path `threadId`.",
    eventName: "thread_id_mismatch",
    action: "validate_payload",
    message: "`thread.id` must match path `threadId`.",
    context: {
      payloadThreadId,
    },
  };
}

export function readThreadRestoreRequest(
  value: unknown,
): ThreadRouteParseResult<true> {
  if (isThreadRestorePayload(value)) {
    return {
      ok: true,
      value: true,
    };
  }

  return {
    ok: false,
    issue: {
      statusCode: 422,
      code: "invalid_restore_payload",
      error: "`archived` must be false.",
      eventName: "invalid_restore_payload",
      action: "validate_payload",
      message: "`archived` must be false.",
    },
  };
}
