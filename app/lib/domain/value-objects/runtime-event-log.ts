export const APP_EVENT_LOG_MAX_CATEGORY_LENGTH = 80;
export const APP_EVENT_LOG_MAX_EVENT_NAME_LENGTH = 120;
export const APP_EVENT_LOG_MAX_MESSAGE_LENGTH = 4_000;
export const APP_EVENT_LOG_MAX_TEXT_LENGTH = 8_000;
export const APP_EVENT_LOG_MAX_PATH_LENGTH = 1_024;
export const APP_EVENT_LOG_MAX_CONTEXT_DEPTH = 6;
export const APP_EVENT_LOG_MAX_CONTEXT_KEYS = 200;
export const APP_EVENT_LOG_MAX_CONTEXT_ARRAY_ITEMS = 200;

export type RuntimeEventLogSource = "server" | "client";
export type RuntimeEventLogLevel = "error" | "warning" | "info";

export type RuntimeEventLogInput = {
  id?: string;
  createdAt?: string;
  source: RuntimeEventLogSource;
  level: RuntimeEventLogLevel;
  category: string;
  eventName: string;
  message: string;
  errorName?: string | null;
  location?: string | null;
  action?: string | null;
  statusCode?: number | null;
  httpMethod?: string | null;
  httpPath?: string | null;
  threadId?: string | null;
  tenantId?: string | null;
  principalId?: string | null;
  userId?: number | null;
  stack?: string | null;
  context?: unknown;
};

export type RuntimeEventLogRecord = {
  id: string;
  createdAt: string;
  source: RuntimeEventLogSource;
  level: RuntimeEventLogLevel;
  category: string;
  eventName: string;
  message: string;
  errorName: string | null;
  location: string | null;
  action: string | null;
  statusCode: number | null;
  httpMethod: string | null;
  httpPath: string | null;
  threadId: string | null;
  tenantId: string | null;
  principalId: string | null;
  userId: number | null;
  stack: string | null;
  context: Record<string, unknown>;
};

export function normalizeRuntimeEventLogLevel(
  value: unknown,
): RuntimeEventLogLevel {
  return value === "error" || value === "warning" || value === "info"
    ? value
    : "error";
}

export function normalizeRuntimeEventLogSource(
  value: unknown,
): RuntimeEventLogSource {
  return value === "client" || value === "server" ? value : "server";
}

export function readRuntimeEventLogErrorDetails(error: unknown): {
  name: string;
  message: string;
  stack: string | null;
} {
  if (error instanceof Error) {
    const name =
      normalizeRequiredText(error.name, APP_EVENT_LOG_MAX_EVENT_NAME_LENGTH) ||
      "Error";
    const message =
      normalizeRequiredText(error.message, APP_EVENT_LOG_MAX_MESSAGE_LENGTH) ||
      "Unknown error.";
    const stack = normalizeOptionalText(error.stack, APP_EVENT_LOG_MAX_TEXT_LENGTH);
    return {
      name,
      message,
      stack,
    };
  }

  const message =
    typeof error === "string"
      ? normalizeRequiredText(error, APP_EVENT_LOG_MAX_MESSAGE_LENGTH)
      : normalizeRequiredText(
          safeStringify(error),
          APP_EVENT_LOG_MAX_MESSAGE_LENGTH,
        );

  return {
    name: "UnknownError",
    message: message || "Unknown error.",
    stack: null,
  };
}

export function normalizeRuntimeEventLogCreatedAt(value: unknown): string {
  const normalized = normalizeOptionalText(value, 64);
  if (!normalized) {
    return new Date().toISOString();
  }

  const parsedMs = Date.parse(normalized);
  return Number.isFinite(parsedMs)
    ? new Date(parsedMs).toISOString()
    : new Date().toISOString();
}

export function normalizeRuntimeEventLogCategory(value: unknown): string {
  return normalizeRequiredText(value, APP_EVENT_LOG_MAX_CATEGORY_LENGTH) ||
    "general";
}

export function normalizeRuntimeEventLogEventName(value: unknown): string {
  return normalizeRequiredText(value, APP_EVENT_LOG_MAX_EVENT_NAME_LENGTH) ||
    "unknown_event";
}

export function normalizeRuntimeEventLogMessage(value: unknown): string {
  return normalizeRequiredText(value, APP_EVENT_LOG_MAX_MESSAGE_LENGTH) ||
    "Unknown error.";
}

export function normalizeRuntimeEventLogStatusCode(value: unknown): number | null {
  return normalizeOptionalSafeInteger(value);
}

export function normalizeRuntimeEventLogPath(value: unknown): string | null {
  return normalizeOptionalText(value, APP_EVENT_LOG_MAX_PATH_LENGTH);
}

export function normalizeRuntimeEventLogLabel(value: unknown): string | null {
  return normalizeOptionalText(value, APP_EVENT_LOG_MAX_EVENT_NAME_LENGTH);
}

export function normalizeRuntimeEventLogText(value: unknown): string | null {
  return normalizeOptionalText(value, APP_EVENT_LOG_MAX_TEXT_LENGTH);
}

export function normalizeRuntimeEventLogUserId(value: unknown): number | null {
  return normalizeOptionalSafeInteger(value);
}

export function serializeRuntimeEventLogContext(context: unknown): string {
  try {
    const safeContext = sanitizeJsonValue(context, 0);
    return JSON.stringify(safeContext ?? {});
  } catch {
    return JSON.stringify({
      serializationError: "Failed to serialize event context.",
    });
  }
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

function sanitizeJsonValue(value: unknown, depth: number): unknown {
  if (value === null) {
    return null;
  }

  if (typeof value === "string") {
    return value.slice(0, APP_EVENT_LOG_MAX_TEXT_LENGTH);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (depth >= APP_EVENT_LOG_MAX_CONTEXT_DEPTH) {
    return "[truncated]";
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, APP_EVENT_LOG_MAX_CONTEXT_ARRAY_ITEMS)
      .map((entry) => sanitizeJsonValue(entry, depth + 1));
  }

  if (!isRecord(value)) {
    return safeStringify(value);
  }

  const entries = Object.entries(value).slice(0, APP_EVENT_LOG_MAX_CONTEXT_KEYS);
  const sanitized: Record<string, unknown> = {};
  for (const [rawKey, rawValue] of entries) {
    const key = rawKey.trim().slice(0, APP_EVENT_LOG_MAX_EVENT_NAME_LENGTH);
    if (!key) {
      continue;
    }
    sanitized[key] = sanitizeJsonValue(rawValue, depth + 1);
  }

  return sanitized;
}

function safeStringify(value: unknown): string {
  try {
    if (typeof value === "string") {
      return value;
    }

    return JSON.stringify(value);
  } catch {
    return "[unserializable]";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
