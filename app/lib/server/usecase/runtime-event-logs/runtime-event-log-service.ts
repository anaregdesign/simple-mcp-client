/**
 * Runtime event log application service module.
 */
import { readAzureArmUserContext } from "~/lib/server/auth/azure-user";
import { readRuntimeEventLogByIdForUser } from "~/lib/server/observability/runtime-event-log";
import { getOrCreateUserByIdentity } from "~/lib/server/infrastructure/persistence/user";

export type RuntimeEventLogReadResult =
  | { status: "auth_required" }
  | { status: "not_found"; tenantId: string; principalId: string; userId: number }
  | {
      status: "ok";
      tenantId: string;
      principalId: string;
      userId: number;
      eventLog: Awaited<ReturnType<typeof readRuntimeEventLogByIdForUser>>;
    };

export class RuntimeEventLogService {
  async readRuntimeEventLogForCurrentUser(
    eventLogId: string,
  ): Promise<RuntimeEventLogReadResult> {
    const identity = await readAzureArmUserContext();
    if (!identity) {
      return { status: "auth_required" };
    }

    const user = await getOrCreateUserByIdentity({
      tenantId: identity.tenantId,
      principalId: identity.principalId,
    });
    const eventLog = await readRuntimeEventLogByIdForUser({
      eventLogId,
      tenantId: identity.tenantId,
      principalId: identity.principalId,
      userId: user.id,
    });
    if (!eventLog) {
      return {
        status: "not_found",
        tenantId: identity.tenantId,
        principalId: identity.principalId,
        userId: user.id,
      };
    }

    return {
      status: "ok",
      tenantId: identity.tenantId,
      principalId: identity.principalId,
      userId: user.id,
      eventLog,
    };
  }
}

export const runtimeEventLogService = new RuntimeEventLogService();
