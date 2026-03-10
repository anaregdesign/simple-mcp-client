/**
 * Shared runtime event-log transport contract module.
 */
import {
  normalizeRuntimeEventLogCategory,
  normalizeRuntimeEventLogEventName,
  normalizeRuntimeEventLogLabel,
  normalizeRuntimeEventLogLevel,
  normalizeRuntimeEventLogMessage,
  normalizeRuntimeEventLogPath,
  normalizeRuntimeEventLogStatusCode,
  normalizeRuntimeEventLogText,
  type RuntimeEventLogLevel,
} from "~/lib/domain/value-objects/runtime-event-log";

export type ClientRuntimeEventLogPayload = {
  level: RuntimeEventLogLevel;
  category: string;
  eventName: string;
  message: string;
  errorName?: string;
  location?: string;
  action?: string;
  statusCode?: number;
  threadId?: string;
  stack?: string;
  context?: unknown;
};

export function readClientRuntimeEventLogPayload(
  value: unknown,
): ClientRuntimeEventLogPayload | null {
  if (!isRecord(value)) {
    return null;
  }

  const category = readRequiredText(value.category);
  const eventName = readRequiredText(value.eventName);
  const message = readRequiredText(value.message);
  if (!category || !eventName || !message) {
    return null;
  }

  const errorName = normalizeRuntimeEventLogLabel(value.errorName);
  const location = normalizeRuntimeEventLogPath(value.location);
  const action = normalizeRuntimeEventLogLabel(value.action);
  const statusCode = normalizeRuntimeEventLogStatusCode(value.statusCode);
  const threadId = normalizeRuntimeEventLogLabel(value.threadId);
  const stack = normalizeRuntimeEventLogText(value.stack);

  return {
    level: normalizeRuntimeEventLogLevel(value.level),
    category: normalizeRuntimeEventLogCategory(category),
    eventName: normalizeRuntimeEventLogEventName(eventName),
    message: normalizeRuntimeEventLogMessage(message),
    ...(errorName ? { errorName } : {}),
    ...(location ? { location } : {}),
    ...(action ? { action } : {}),
    ...(statusCode !== null ? { statusCode } : {}),
    ...(threadId ? { threadId } : {}),
    ...(stack ? { stack } : {}),
    ...(value.context !== undefined ? { context: value.context } : {}),
  };
}

function readRequiredText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
