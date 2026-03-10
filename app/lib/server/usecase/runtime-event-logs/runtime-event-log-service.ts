/**
 * Runtime event log application service module.
 */
import type { RuntimeEventLogRecord } from "~/lib/domain/value-objects/runtime-event-log";
import type {
  RuntimeEventLogOwner,
  RuntimeEventLogRepository,
} from "~/lib/domain/repositories/runtime-event-log-repository";

export type RuntimeEventLogReadResult =
  | { status: "not_found" }
  | {
      status: "ok";
      eventLog: RuntimeEventLogRecord;
    };

export class RuntimeEventLogService {
  constructor(
    private readonly repository: RuntimeEventLogRepository,
  ) {}

  async readRuntimeEventLogForUser(
    eventLogId: string,
    owner: RuntimeEventLogOwner,
  ): Promise<RuntimeEventLogReadResult> {
    const eventLog = await this.repository.findByIdForOwner({
      eventLogId,
      tenantId: owner.tenantId,
      principalId: owner.principalId,
      userId: owner.userId,
    });
    if (!eventLog) {
      return { status: "not_found" };
    }

    return {
      status: "ok",
      eventLog,
    };
  }
}

export function createRuntimeEventLogService(
  repository: RuntimeEventLogRepository,
): RuntimeEventLogService {
  return new RuntimeEventLogService(repository);
}
