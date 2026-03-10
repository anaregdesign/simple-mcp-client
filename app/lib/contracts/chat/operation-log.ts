import { readThreadEnvironmentFromUnknown } from "~/lib/domain/value-objects/thread-environment";
import {
  readThreadMessageFromUnknown,
  type ThreadMessage,
} from "~/lib/contracts/chat/messages";

export type ChatRunResponse = {
  assistantMessage?: ThreadMessage;
  threadEnvironment?: Record<string, string>;
  error?: string;
  errorCode?: "azure_login_required";
};

export type ThreadOperationLogEntry = {
  id: string;
  sequence: number;
  operationType: "mcp" | "skill";
  serverName: string;
  method: string;
  startedAt: string;
  completedAt: string;
  request: unknown;
  response: unknown;
  isError: boolean;
  turnId: string;
};

export type ThreadOperationLogType = "mcp" | "skill";

type ChatStreamProgressEvent = {
  type: "progress";
  message?: unknown;
};

type ChatStreamFinalEvent = {
  type: "final";
  assistantMessage?: unknown;
  threadEnvironment?: unknown;
};

type ChatStreamErrorEvent = {
  type: "error";
  error?: unknown;
  errorCode?: unknown;
};

type ChatStreamOperationLogEvent = {
  type: "operation_log";
  record?: unknown;
};

type ChatStreamEvent =
  | ChatStreamProgressEvent
  | ChatStreamFinalEvent
  | ChatStreamErrorEvent
  | ChatStreamOperationLogEvent;

export function parseSseDataBlock(block: string): string | null {
  const lines = block.split("\n");
  const dataLines = lines
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart());

  if (dataLines.length === 0) {
    return null;
  }

  return dataLines.join("\n").trim();
}

export function readChatStreamEvent(data: string): (
  | { type: "progress"; message: string }
  | {
      type: "final";
      assistantMessage: ThreadMessage;
      threadEnvironment: Record<string, string>;
    }
  | { type: "error"; error: string; errorCode?: "azure_login_required" }
  | { type: "operation_log"; record: ThreadOperationLogEntry }
) | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }

  if (!isRecord(parsed) || typeof parsed.type !== "string") {
    return null;
  }

  if (parsed.type === "progress") {
    const message = typeof parsed.message === "string" ? parsed.message.trim() : "";
    if (!message) {
      return null;
    }
    return {
      type: "progress",
      message,
    };
  }

  if (parsed.type === "final") {
    const assistantMessage = readThreadMessageFromUnknown(parsed.assistantMessage);
    if (!assistantMessage) {
      return null;
    }
    return {
      type: "final",
      assistantMessage,
      threadEnvironment: readThreadEnvironmentFromUnknown(parsed.threadEnvironment),
    };
  }

  if (parsed.type === "error") {
    const error = typeof parsed.error === "string" ? parsed.error : "Failed to send message.";
    return {
      type: "error",
      error,
      ...(parsed.errorCode === "azure_login_required"
        ? { errorCode: parsed.errorCode }
        : {}),
    };
  }

  if (parsed.type === "operation_log") {
    const record = readThreadOperationLogEntryFromUnknown(parsed.record);
    if (!record) {
      return null;
    }

    return {
      type: "operation_log",
      record,
    };
  }

  return null;
}

export function readThreadOperationLogEntryFromUnknown(
  value: unknown,
): ThreadOperationLogEntry | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = typeof value.id === "string" ? value.id.trim() : "";
  const sequence = typeof value.sequence === "number" ? value.sequence : Number.NaN;
  const serverName = typeof value.serverName === "string" ? value.serverName.trim() : "";
  const method = typeof value.method === "string" ? value.method.trim() : "";
  const operationType = value.operationType === "skill" ? "skill" : "mcp";
  const startedAt = typeof value.startedAt === "string" ? value.startedAt.trim() : "";
  const completedAt = typeof value.completedAt === "string" ? value.completedAt.trim() : "";
  const isError = value.isError === true;

  if (
    !id ||
    !Number.isSafeInteger(sequence) ||
    sequence < 1 ||
    !serverName ||
    !method ||
    !startedAt ||
    !completedAt
  ) {
    return null;
  }

  return {
    id,
    sequence,
    operationType,
    serverName,
    method,
    startedAt,
    completedAt,
    request: "request" in value ? value.request : null,
    response: "response" in value ? value.response : null,
    isError,
    turnId: "",
  };
}

export function readPersistedThreadOperationLogEntryFromUnknown(
  value: unknown,
  options: {
    allowedKeys?: ReadonlySet<string>;
  } = {},
): ThreadOperationLogEntry | null {
  const parsed = readThreadOperationLogEntryFromUnknown(value);
  if (!parsed || !isRecord(value)) {
    return null;
  }

  if (options.allowedKeys && !hasOnlyAllowedKeys(value, options.allowedKeys)) {
    return null;
  }

  const turnId = typeof value.turnId === "string" ? value.turnId.trim() : "";
  if (!turnId) {
    return null;
  }

  return {
    ...parsed,
    turnId,
  };
}

export function upsertThreadOperationLogEntry(
  current: ThreadOperationLogEntry[],
  entry: ThreadOperationLogEntry,
): ThreadOperationLogEntry[] {
  const existingIndex = current.findIndex((existing) => existing.id === entry.id);
  if (existingIndex < 0) {
    const insertIndex = findThreadOperationLogInsertIndex(current, entry);
    if (insertIndex === current.length) {
      return [...current, entry];
    }
    return [...current.slice(0, insertIndex), entry, ...current.slice(insertIndex)];
  }

  const existing = current[existingIndex];
  if (compareThreadOperationLogOrder(existing, entry) === 0) {
    const next = [...current];
    next[existingIndex] = entry;
    return next;
  }

  const withoutExisting = [
    ...current.slice(0, existingIndex),
    ...current.slice(existingIndex + 1),
  ];
  const insertIndex = findThreadOperationLogInsertIndex(withoutExisting, entry);
  if (insertIndex === withoutExisting.length) {
    return [...withoutExisting, entry];
  }
  return [
    ...withoutExisting.slice(0, insertIndex),
    entry,
    ...withoutExisting.slice(insertIndex),
  ];
}

export function readOperationLogType(
  entry: Pick<ThreadOperationLogEntry, "method"> &
    Partial<Pick<ThreadOperationLogEntry, "operationType">>,
): ThreadOperationLogType {
  if (entry.operationType === "skill") {
    return "skill";
  }
  if (entry.operationType === "mcp") {
    return "mcp";
  }

  return entry.method.startsWith("skill_") ? "skill" : "mcp";
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function hasOnlyAllowedKeys(
  value: Record<string, unknown>,
  allowedKeys: ReadonlySet<string>,
): boolean {
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function compareThreadOperationLogOrder(
  left: Pick<ThreadOperationLogEntry, "startedAt" | "sequence">,
  right: Pick<ThreadOperationLogEntry, "startedAt" | "sequence">,
): number {
  const timeOrder = left.startedAt.localeCompare(right.startedAt);
  if (timeOrder !== 0) {
    return timeOrder;
  }
  return left.sequence - right.sequence;
}

function findThreadOperationLogInsertIndex(
  entries: ThreadOperationLogEntry[],
  entry: ThreadOperationLogEntry,
): number {
  for (let index = 0; index < entries.length; index += 1) {
    if (compareThreadOperationLogOrder(entry, entries[index]!) < 0) {
      return index;
    }
  }

  return entries.length;
}
