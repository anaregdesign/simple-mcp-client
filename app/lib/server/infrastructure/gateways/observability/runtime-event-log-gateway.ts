/**
 * Server runtime module.
 */
import {
  readErrorDetails,
} from "~/lib/domain/entities/runtime-event-log";
import type {
  RuntimeEventLogInput,
  RuntimeEventLogLevel,
  RuntimeEventLogReadRecord,
} from "~/lib/domain/entities/runtime-event-log";
import { runtimeEventLogPersistenceRepository } from "~/lib/server/infrastructure/repositories/runtime-event-log-persistence-repository";

type ProcessWithUncaughtMonitor = NodeJS.Process & {
  on(event: "uncaughtExceptionMonitor", listener: (error: Error, origin: string) => void): NodeJS.Process;
};

type ServerRouteEventInput = {
  request?: Request;
  route: string;
  eventName: string;
  action?: string;
  category?: string;
  level?: RuntimeEventLogLevel;
  message?: string;
  error?: unknown;
  statusCode?: number;
  threadId?: string | null;
  tenantId?: string | null;
  principalId?: string | null;
  userId?: number | null;
  context?: unknown;
};

const globalForServerEventLog = globalThis as typeof globalThis & {
  __localPlaygroundServerErrorHooksInstalled?: boolean;
};

export function installGlobalServerErrorLogging(): void {
  if (globalForServerEventLog.__localPlaygroundServerErrorHooksInstalled) {
    return;
  }

  const monitoredProcess = process as ProcessWithUncaughtMonitor;

  monitoredProcess.on("uncaughtExceptionMonitor", (error, origin) => {
    const details = readErrorDetails(error);
    void logRuntimeEvent({
      source: "server",
      level: "error",
      category: "runtime",
      eventName: "uncaught_exception",
      message: details.message,
      errorName: details.name,
      stack: details.stack,
      location: "process",
      action: origin,
      context: {
        origin,
      },
    });
  });

  process.on("unhandledRejection", (reason) => {
    const details = readErrorDetails(reason);
    void logRuntimeEvent({
      source: "server",
      level: "error",
      category: "runtime",
      eventName: "unhandled_rejection",
      message: details.message,
      errorName: details.name,
      stack: details.stack,
      location: "process",
      action: "unhandledRejection",
      context: {
        reasonType: typeof reason,
      },
    });
  });

  process.on("warning", (warning) => {
    const details = readErrorDetails(warning);
    void logRuntimeEvent({
      source: "server",
      level: "warning",
      category: "runtime",
      eventName: "process_warning",
      message: details.message,
      errorName: details.name,
      stack: details.stack,
      location: "process",
      action: "warning",
      context: {
        warningCode:
          warning && typeof warning === "object" && "code" in warning
            ? (warning as { code?: unknown }).code
            : null,
      },
    });
  });

  globalForServerEventLog.__localPlaygroundServerErrorHooksInstalled = true;
}

export async function logServerRouteEvent(input: ServerRouteEventInput): Promise<void> {
  const details = input.error !== undefined ? readErrorDetails(input.error) : null;
  const requestPath = input.request ? new URL(input.request.url).pathname : null;
  const message =
    typeof input.message === "string" && input.message.trim()
      ? input.message
      : details?.message ?? "Unknown error.";

  await logRuntimeEvent({
    source: "server",
    level: input.level ?? "error",
    category: input.category ?? "api",
    eventName: input.eventName,
    message,
    errorName: details?.name ?? null,
    stack: details?.stack ?? null,
    location: input.route,
    action: input.action ?? null,
    statusCode: input.statusCode ?? null,
    httpMethod: input.request?.method ?? null,
    httpPath: requestPath,
    threadId: input.threadId ?? null,
    tenantId: input.tenantId ?? null,
    principalId: input.principalId ?? null,
    userId: input.userId ?? null,
    context: input.context ?? {},
  });
}

export async function logRuntimeEvent(input: RuntimeEventLogInput): Promise<void> {
  await createRuntimeEventLog(input);
}

export async function logRuntimeEventWithId(input: RuntimeEventLogInput): Promise<string | null> {
  return await createRuntimeEventLog(input);
}

export async function readRuntimeEventLogByIdForUser(options: {
  eventLogId: string;
  tenantId: string;
  principalId: string;
  userId: number | null;
}): Promise<RuntimeEventLogReadRecord | null> {
  const eventLogId = options.eventLogId.trim();
  if (!eventLogId) {
    return null;
  }

  return runtimeEventLogPersistenceRepository.findByIdForOwner({
    eventLogId,
    tenantId: options.tenantId,
    principalId: options.principalId,
    userId: options.userId,
  });
}

async function createRuntimeEventLog(input: RuntimeEventLogInput): Promise<string | null> {
  try {
    return await runtimeEventLogPersistenceRepository.create(input);
  } catch {
    return null;
  }
}
