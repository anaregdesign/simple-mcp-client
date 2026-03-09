/**
 * Shared observability module.
 */
import {
  APP_EVENT_LOG_MAX_CATEGORY_LENGTH,
  APP_EVENT_LOG_MAX_EVENT_NAME_LENGTH,
  APP_EVENT_LOG_MAX_MESSAGE_LENGTH,
  APP_EVENT_LOG_MAX_PATH_LENGTH,
  APP_EVENT_LOG_MAX_TEXT_LENGTH,
} from "~/lib/constants/persistence";
import {
  normalizeRuntimeEventLogLevel,
  type RuntimeEventLogInput,
  type RuntimeEventLogLevel,
  type RuntimeEventLogSource,
} from "~/lib/domain/entities/runtime-event-log";

export type { RuntimeEventLogInput, RuntimeEventLogLevel, RuntimeEventLogSource };
export {
  createRuntimeEventLogId,
  normalizeCategory,
  normalizeCreatedAt,
  normalizeEventName,
  normalizeMessage,
  normalizeOptionalLabel,
  normalizeOptionalPath,
  normalizeOptionalStatusCode,
  normalizeOptionalTextValue,
  normalizeOptionalUserId,
  normalizeRuntimeEventLogSource,
  readErrorDetails,
  serializeRuntimeEventContext,
} from "~/lib/domain/entities/runtime-event-log";

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

export function readClientRuntimeEventLogPayload(value: unknown): ClientRuntimeEventLogPayload | null {
  if (!isRecord(value)) {
    return null;
  }

  const category = normalizeRequiredText(value.category, APP_EVENT_LOG_MAX_CATEGORY_LENGTH);
  const eventName = normalizeRequiredText(value.eventName, APP_EVENT_LOG_MAX_EVENT_NAME_LENGTH);
  const message = normalizeRequiredText(value.message, APP_EVENT_LOG_MAX_MESSAGE_LENGTH);
  if (!category || !eventName || !message) {
    return null;
  }

  const level = normalizeRuntimeEventLogLevel(value.level);
  const errorName = normalizeOptionalText(value.errorName, APP_EVENT_LOG_MAX_EVENT_NAME_LENGTH);
  const location = normalizeOptionalText(value.location, APP_EVENT_LOG_MAX_PATH_LENGTH);
  const action = normalizeOptionalText(value.action, APP_EVENT_LOG_MAX_EVENT_NAME_LENGTH);
  const statusCode = normalizeOptionalSafeInteger(value.statusCode);
  const threadId = normalizeOptionalText(value.threadId, APP_EVENT_LOG_MAX_EVENT_NAME_LENGTH);
  const stack = normalizeOptionalText(value.stack, APP_EVENT_LOG_MAX_TEXT_LENGTH);
  const context = value.context;

  return {
    level,
    category,
    eventName,
    message,
    ...(errorName ? { errorName } : {}),
    ...(location ? { location } : {}),
    ...(action ? { action } : {}),
    ...(statusCode !== null ? { statusCode } : {}),
    ...(threadId ? { threadId } : {}),
    ...(stack ? { stack } : {}),
    ...(context !== undefined ? { context } : {}),
  };
}

function normalizeOptionalSafeInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    return null;
  }

  return value;
}

function normalizeRequiredText(value: unknown, maxLength: number): string {
  const normalized = normalizeOptionalText(value, maxLength);
  return normalized ?? "";
}

function normalizeOptionalText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
