export type ThreadOperationType = "mcp" | "skill";

export type OrderedThreadOperationLogEntry = {
  id: string;
  startedAt: string;
  sequence: number;
};

export type ThreadOperationLog = {
  rowId: string;
  sourceRpcId: string;
  threadId: string;
  conversationOrder: number;
  sequence: number;
  operationType: ThreadOperationType;
  serverName: string;
  method: string;
  startedAt: string;
  completedAt: string;
  request: unknown;
  response: unknown;
  isError: boolean;
  turnId: string;
};

export function cloneThreadOperationLog(
  entry: ThreadOperationLog,
): ThreadOperationLog {
  return {
    ...entry,
    request: cloneJsonCompatibleValue(entry.request),
    response: cloneJsonCompatibleValue(entry.response),
  };
}

export function cloneThreadOperationLogs(
  entries: ThreadOperationLog[],
): ThreadOperationLog[] {
  return entries.map(cloneThreadOperationLog);
}

export function compareThreadOperationLogOrder(
  left: Pick<OrderedThreadOperationLogEntry, "startedAt" | "sequence">,
  right: Pick<OrderedThreadOperationLogEntry, "startedAt" | "sequence">,
): number {
  const timeOrder = left.startedAt.localeCompare(right.startedAt);
  if (timeOrder !== 0) {
    return timeOrder;
  }

  return left.sequence - right.sequence;
}

export function findThreadOperationLogInsertIndex<
  Entry extends OrderedThreadOperationLogEntry,
>(entries: Entry[], entry: Entry): number {
  for (let index = 0; index < entries.length; index += 1) {
    if (compareThreadOperationLogOrder(entry, entries[index]!) < 0) {
      return index;
    }
  }

  return entries.length;
}

export function upsertThreadOperationLogEntry<
  Entry extends OrderedThreadOperationLogEntry,
>(current: Entry[], entry: Entry): Entry[] {
  const existingIndex = current.findIndex(
    (existing) => existing.id === entry.id,
  );
  if (existingIndex < 0) {
    const insertIndex = findThreadOperationLogInsertIndex(current, entry);
    if (insertIndex === current.length) {
      return [...current, entry];
    }

    return [
      ...current.slice(0, insertIndex),
      entry,
      ...current.slice(insertIndex),
    ];
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

export function cloneJsonCompatibleValue<T>(value: T): T {
  if (value === null || value === undefined || typeof value !== "object") {
    return value;
  }

  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}
