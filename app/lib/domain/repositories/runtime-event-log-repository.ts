import type {
  RuntimeEventLogInput,
  RuntimeEventLogRecord,
} from "~/lib/domain/value-objects/runtime-event-log";

export type RuntimeEventLogOwner = {
  tenantId: string;
  principalId: string;
  userId: number | null;
};

export interface RuntimeEventLogRepository {
  create(input: RuntimeEventLogInput): Promise<string | null>;
  findByIdForOwner(
    options: RuntimeEventLogOwner & {
      eventLogId: string;
    },
  ): Promise<RuntimeEventLogRecord | null>;
}
