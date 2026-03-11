import type { ThreadOperationLogEntry } from "~/lib/contracts/chat/operation-log";
import { readOperationLogType } from "~/lib/contracts/chat/operation-log";

export function buildThreadOperationLogCopyPayload(
  entry: ThreadOperationLogEntry,
): Record<string, unknown> {
  return {
    operationType: readOperationLogType(entry),
    id: entry.id,
    sequence: entry.sequence,
    serverName: entry.serverName,
    method: entry.method,
    startedAt: entry.startedAt,
    completedAt: entry.completedAt,
    request: entry.request ?? null,
    response: entry.response ?? null,
    isError: entry.isError,
    turnId: entry.turnId,
  };
}
