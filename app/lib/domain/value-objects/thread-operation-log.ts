export type ThreadOperationType = "mcp" | "skill";

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

export function cloneJsonCompatibleValue<T>(value: T): T {
  if (value === null || value === undefined || typeof value !== "object") {
    return value;
  }

  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}
