import type { ThreadOperationLogEntry } from "~/lib/contracts/chat/operation-log";

export function buildThreadOperationLogsByTurnId(
  entries: ThreadOperationLogEntry[],
): Map<string, ThreadOperationLogEntry[]> {
  const byTurnId = new Map<string, ThreadOperationLogEntry[]>();
  for (const entry of entries) {
    if (!entry.turnId) {
      continue;
    }

    const current = byTurnId.get(entry.turnId) ?? [];
    current.push(entry);
    byTurnId.set(entry.turnId, current);
  }

  return byTurnId;
}
