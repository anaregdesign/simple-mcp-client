/**
 * API route module for /api/runtime/event-logs/:eventLogId.
 */
import {
  createRuntimeEventLogService,
} from "~/lib/server/usecase/runtime-event-logs/runtime-event-log-service";
import {
  runtimeEventLogPersistenceRepository,
} from "~/lib/server/infrastructure/repositories/runtime-event-log-persistence-repository";
import {
  handleRuntimeEventLogItemAction,
  handleRuntimeEventLogItemLoader,
} from "~/lib/server/http/runtime-event-logs/runtime-event-log-item-action";
import type { Route } from "./+types/api.runtime.event-logs.$eventLogId";

function getRuntimeEventLogService() {
  return createRuntimeEventLogService(runtimeEventLogPersistenceRepository);
}

export function action() {
  return handleRuntimeEventLogItemAction();
}

export async function loader({ request, params }: Route.LoaderArgs) {
  return handleRuntimeEventLogItemLoader({
    request,
    eventLogIdParam: params.eventLogId,
    runtimeEventLogService: getRuntimeEventLogService(),
  });
}
