import {
  authRequiredResponse,
  errorResponse,
  methodNotAllowedResponse,
  validationErrorResponse,
} from "~/lib/server/http";
import {
  installGlobalServerErrorLogging,
  logServerRouteEvent,
} from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import { readAuthenticatedWorkspaceUser } from "~/lib/server/infrastructure/auth/read-authenticated-user";
import type { RuntimeEventLogService } from "~/lib/server/usecase/runtime-event-logs/runtime-event-log-service";

const RUNTIME_EVENT_LOG_ITEM_ALLOWED_METHODS = ["GET"] as const;
const RUNTIME_EVENT_LOG_ITEM_ROUTE_PATH = "/api/runtime/event-logs/:eventLogId";

export function handleRuntimeEventLogItemAction(): Response {
  installGlobalServerErrorLogging();
  return methodNotAllowedResponse(RUNTIME_EVENT_LOG_ITEM_ALLOWED_METHODS);
}

export async function handleRuntimeEventLogItemLoader(options: {
  request: Request;
  eventLogIdParam: unknown;
  runtimeEventLogService: RuntimeEventLogService;
}): Promise<Response> {
  const { request, eventLogIdParam, runtimeEventLogService } = options;
  installGlobalServerErrorLogging();

  if (request.method !== "GET") {
    return methodNotAllowedResponse(RUNTIME_EVENT_LOG_ITEM_ALLOWED_METHODS);
  }

  const eventLogId =
    typeof eventLogIdParam === "string" ? eventLogIdParam.trim() : "";
  if (!eventLogId) {
    await logServerRouteEvent({
      request,
      route: RUNTIME_EVENT_LOG_ITEM_ROUTE_PATH,
      eventName: "invalid_event_log_id",
      action: "read_event_log_id",
      level: "warning",
      statusCode: 422,
      message: "Invalid event log id.",
    });

    return validationErrorResponse(
      "invalid_event_log_id",
      "Invalid event log id.",
    );
  }

  const user = await readAuthenticatedWorkspaceUser();
  if (!user) {
    return authRequiredResponse();
  }

  try {
    const result = await runtimeEventLogService.readRuntimeEventLogForUser(
      eventLogId,
      {
        tenantId: user.tenantId,
        principalId: user.principalId,
        userId: user.id,
      },
    );
    if (result.status === "not_found") {
      return errorResponse({
        status: 404,
        code: "runtime_event_log_not_found",
        error: "Runtime event log is not available.",
      });
    }

    return Response.json({ eventLog: result.eventLog });
  } catch (error) {
    await logServerRouteEvent({
      request,
      route: RUNTIME_EVENT_LOG_ITEM_ROUTE_PATH,
      eventName: "read_runtime_event_log_failed",
      action: "read_runtime_event_log",
      statusCode: 500,
      error,
      context: {
        eventLogId,
        tenantId: user.tenantId,
        principalId: user.principalId,
      },
    });

    return errorResponse({
      status: 500,
      code: "read_runtime_event_log_failed",
      error:
        error instanceof Error
          ? `Failed to read runtime event log: ${error.message}`
          : "Failed to read runtime event log: Unknown error.",
    });
  }
}
