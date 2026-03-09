import type {
  RuntimeEventLogInput,
  RuntimeEventLogReadRecord,
} from "~/lib/domain/entities/runtime-event-log";

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
  ): Promise<RuntimeEventLogReadRecord | null>;
}
