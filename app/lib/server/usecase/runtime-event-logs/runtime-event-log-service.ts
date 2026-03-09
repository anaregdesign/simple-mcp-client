/**
 * Runtime event log application service module.
 */
import { readRuntimeEventLogByIdForUser } from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import type { AuthenticatedWorkspaceUser } from "~/lib/server/infrastructure/auth/read-authenticated-user";

export type RuntimeEventLogReadResult =
  | { status: "not_found" }
  | {
      status: "ok";
      eventLog: Awaited<ReturnType<typeof readRuntimeEventLogByIdForUser>>;
    };

export class RuntimeEventLogService {
  async readRuntimeEventLogForUser(
    eventLogId: string,
    user: AuthenticatedWorkspaceUser,
  ): Promise<RuntimeEventLogReadResult> {
    const eventLog = await readRuntimeEventLogByIdForUser({
      eventLogId,
      tenantId: user.tenantId,
      principalId: user.principalId,
      userId: user.id,
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

export const runtimeEventLogService = new RuntimeEventLogService();
