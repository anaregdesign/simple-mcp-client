import { DEFAULT_AGENT_INSTRUCTION } from "~/lib/constants/chat";
import { readThreadWritePayloadFromUnknown } from "~/lib/contracts/threads/parsers";
import type { ThreadSaveInput } from "~/lib/domain/repositories/thread-repository";

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
): ThreadRouteParseResult<ThreadSaveInput> {
  const thread = readThreadWritePayloadFromUnknown(value, {
    fallbackInstruction: DEFAULT_AGENT_INSTRUCTION,
  });
  if (thread) {
    return {
      ok: true,
      value: {
        id: thread.id,
        name: thread.name,
        createdAt: thread.createdAt,
        reasoningEffort: thread.reasoningEffort,
        webSearchEnabled: thread.webSearchEnabled,
        chatAzureConfig: thread.chatAzureConfig ?? null,
        instructionContent: thread.instruction.content,
        instructionContextToggles: thread.instructionContextToggles,
        threadEnvironment: thread.threadEnvironment,
        messages: thread.messages,
        mcpServers: thread.mcpServers,
        operationLogs: thread.mcpRpcLogs,
        skillSelections: thread.skillSelections,
      },
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

function isThreadRestorePayload(value: unknown): boolean {
  return isRecord(value) && value.archived === false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
