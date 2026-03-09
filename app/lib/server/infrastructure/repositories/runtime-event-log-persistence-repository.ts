import {
  createRuntimeEventLogId,
  normalizeCategory,
  normalizeCreatedAt,
  normalizeEventName,
  normalizeMessage,
  normalizeOptionalLabel,
  normalizeOptionalPath,
  normalizeOptionalStatusCode,
  normalizeOptionalTextValue,
  normalizeOptionalUserId,
  normalizeRuntimeEventLogLevel,
  normalizeRuntimeEventLogSource,
  serializeRuntimeEventContext,
} from "~/lib/contracts/shared/runtime-event-log";
import type {
  RuntimeEventLogInput,
  RuntimeEventLogReadRecord,
} from "~/lib/contracts/shared/runtime-event-log";
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
        : createRuntimeEventLogId();

    try {
      await ensurePersistenceDatabaseReady();
      await prisma.runtimeEventLog.create({
        data: {
          id: runtimeEventLogId,
          createdAt: normalizeCreatedAt(input.createdAt),
          source: normalizeRuntimeEventLogSource(input.source),
          level: normalizeRuntimeEventLogLevel(input.level),
          category: normalizeCategory(input.category),
          eventName: normalizeEventName(input.eventName),
          message: normalizeMessage(input.message),
          errorName: normalizeOptionalLabel(input.errorName),
          location: normalizeOptionalPath(input.location),
          action: normalizeOptionalLabel(input.action),
          statusCode: normalizeOptionalStatusCode(input.statusCode),
          httpMethod: normalizeOptionalLabel(input.httpMethod),
          httpPath: normalizeOptionalPath(input.httpPath),
          threadId: normalizeOptionalLabel(input.threadId),
          tenantId: normalizeOptionalLabel(input.tenantId),
          principalId: normalizeOptionalLabel(input.principalId),
          userId: normalizeOptionalUserId(input.userId),
          stack: normalizeOptionalTextValue(input.stack),
          contextJson: serializeRuntimeEventContext(input.context),
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
  }): Promise<RuntimeEventLogReadRecord | null> {
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
      createdAt: record.createdAt,
      source: record.source,
      level: record.level,
      category: record.category,
      eventName: record.eventName,
      message: record.message,
      errorName: record.errorName,
      location: record.location,
      action: record.action,
      statusCode: record.statusCode,
      httpMethod: record.httpMethod,
      httpPath: record.httpPath,
      threadId: record.threadId,
      tenantId: record.tenantId,
      principalId: record.principalId,
      userId: record.userId,
      stack: record.stack,
      context: readRuntimeEventContext(record.contextJson),
    };
  }
}

export const runtimeEventLogPersistenceRepository =
  new RuntimeEventLogPersistenceRepository();

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
