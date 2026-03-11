/**
 * API route module for /api/runtime/event-logs/:eventLogId.
 */
import {
  handleRuntimeEventLogItemAction,
  handleRuntimeEventLogItemLoader,
} from "~/lib/server/infrastructure/runtime-event-logs/runtime-event-log-item-action";
import {
  createRuntimeEventLogServiceWithInfrastructure,
} from "~/lib/server/infrastructure/runtime-event-logs/runtime-event-log-service-factory";
import type { Route } from "./+types/api.runtime.event-logs.$eventLogId";

export function action() {
  return handleRuntimeEventLogItemAction();
}

export async function loader({ request, params }: Route.LoaderArgs) {
  return handleRuntimeEventLogItemLoader({
    request,
    eventLogIdParam: params.eventLogId,
    runtimeEventLogService: createRuntimeEventLogServiceWithInfrastructure(),
  });
}
