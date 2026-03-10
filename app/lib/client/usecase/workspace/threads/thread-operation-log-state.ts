import type { ThreadOperationLogEntry } from "~/lib/contracts/chat/operation-log";

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
