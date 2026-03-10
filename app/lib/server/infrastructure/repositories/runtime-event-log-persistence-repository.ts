import {
  normalizeRuntimeEventLogCategory,
  normalizeRuntimeEventLogCreatedAt,
  normalizeRuntimeEventLogEventName,
  normalizeRuntimeEventLogLabel,
  normalizeRuntimeEventLogLevel,
  normalizeRuntimeEventLogMessage,
  normalizeRuntimeEventLogPath,
  normalizeRuntimeEventLogSource,
  normalizeRuntimeEventLogStatusCode,
  normalizeRuntimeEventLogText,
  normalizeRuntimeEventLogUserId,
  serializeRuntimeEventLogContext,
} from "~/lib/domain/value-objects/runtime-event-log";
import type {
  RuntimeEventLogInput,
  RuntimeEventLogRecord,
} from "~/lib/domain/value-objects/runtime-event-log";
import type {
  RuntimeEventLogRepository,
} from "~/lib/domain/repositories/runtime-event-log-repository";
import {
  ensurePersistenceDatabaseReady,
  prisma,
} from "~/lib/server/infrastructure/persistence/prisma";

export class RuntimeEventLogPersistenceRepository implements RuntimeEventLogRepository {
  async create(input: RuntimeEventLogInput): Promise<string | null> {
    const runtimeEventLogId =
      typeof input.id === "string" && input.id.trim()
        ? input.id.trim()
        : buildRuntimeEventLogId();

    try {
      await ensurePersistenceDatabaseReady();
      await prisma.runtimeEventLog.create({
        data: {
          id: runtimeEventLogId,
          createdAt: normalizeRuntimeEventLogCreatedAt(input.createdAt),
          source: normalizeRuntimeEventLogSource(input.source),
          level: normalizeRuntimeEventLogLevel(input.level),
          category: normalizeRuntimeEventLogCategory(input.category),
          eventName: normalizeRuntimeEventLogEventName(input.eventName),
          message: normalizeRuntimeEventLogMessage(input.message),
          errorName: normalizeRuntimeEventLogLabel(input.errorName),
          location: normalizeRuntimeEventLogPath(input.location),
          action: normalizeRuntimeEventLogLabel(input.action),
          statusCode: normalizeRuntimeEventLogStatusCode(input.statusCode),
          httpMethod: normalizeRuntimeEventLogLabel(input.httpMethod),
          httpPath: normalizeRuntimeEventLogPath(input.httpPath),
          threadId: normalizeRuntimeEventLogLabel(input.threadId),
          tenantId: normalizeRuntimeEventLogLabel(input.tenantId),
          principalId: normalizeRuntimeEventLogLabel(input.principalId),
          userId: normalizeRuntimeEventLogUserId(input.userId),
          stack: normalizeRuntimeEventLogText(input.stack),
          contextJson: serializeRuntimeEventLogContext(input.context),
        },
      });

      return runtimeEventLogId;
    } catch {
      // Logging must not throw into business logic.
      return null;
    }
  }

  async findByIdForOwner(options: {
    eventLogId: string;
    tenantId: string;
    principalId: string;
    userId: number | null;
  }): Promise<RuntimeEventLogRecord | null> {
    const eventLogId = options.eventLogId.trim();
    if (!eventLogId) {
      return null;
    }

    const ownerFilters: Array<
      | {
          tenantId: string;
          principalId: string;
        }
      | {
          userId: number;
        }
    > = [];
    const tenantId = options.tenantId.trim();
    const principalId = options.principalId.trim();
    if (tenantId && principalId) {
      ownerFilters.push({
        tenantId,
        principalId,
      });
    }

    if (
      typeof options.userId === "number" &&
      Number.isInteger(options.userId) &&
      options.userId > 0
    ) {
      ownerFilters.push({
        userId: options.userId,
      });
    }
    if (ownerFilters.length === 0) {
      return null;
    }

    await ensurePersistenceDatabaseReady();
    const record = await prisma.runtimeEventLog.findFirst({
      where: {
        id: eventLogId,
        OR: ownerFilters,
      },
    });
    if (!record) {
      return null;
    }

    return {
      id: record.id,
      createdAt: normalizeRuntimeEventLogCreatedAt(record.createdAt),
      source: normalizeRuntimeEventLogSource(record.source),
      level: normalizeRuntimeEventLogLevel(record.level),
      category: normalizeRuntimeEventLogCategory(record.category),
      eventName: normalizeRuntimeEventLogEventName(record.eventName),
      message: normalizeRuntimeEventLogMessage(record.message),
      errorName: normalizeRuntimeEventLogLabel(record.errorName),
      location: normalizeRuntimeEventLogPath(record.location),
      action: normalizeRuntimeEventLogLabel(record.action),
      statusCode: normalizeRuntimeEventLogStatusCode(record.statusCode),
      httpMethod: normalizeRuntimeEventLogLabel(record.httpMethod),
      httpPath: normalizeRuntimeEventLogPath(record.httpPath),
      threadId: normalizeRuntimeEventLogLabel(record.threadId),
      tenantId: normalizeRuntimeEventLogLabel(record.tenantId),
      principalId: normalizeRuntimeEventLogLabel(record.principalId),
      userId: normalizeRuntimeEventLogUserId(record.userId),
      stack: normalizeRuntimeEventLogText(record.stack),
      context: readRuntimeEventContext(record.contextJson),
    };
  }
}

export const runtimeEventLogPersistenceRepository =
  new RuntimeEventLogPersistenceRepository();

function buildRuntimeEventLogId(): string {
  const maybeCrypto = globalThis.crypto;
  if (maybeCrypto && typeof maybeCrypto.randomUUID === "function") {
    return maybeCrypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function readRuntimeEventContext(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}
