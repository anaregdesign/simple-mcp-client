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

export type RuntimeEventLogReadRecord = {
  id: string;
  createdAt: string;
  source: string;
  level: string;
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
