import { readClientRuntimeEventLogPayload } from "~/lib/contracts/shared/runtime-event-log";
import { readAzureArmUserContext } from "~/lib/server/infrastructure/auth/azure-arm-user-context";
import {
  installGlobalServerErrorLogging,
  logRuntimeEventWithId,
  logServerRouteEvent,
} from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import {
  errorResponse,
  invalidJsonResponse,
  methodNotAllowedResponse,
  readJsonPayload,
  validationErrorResponse,
} from "~/lib/server/infrastructure/http/route-transport";

const APP_EVENT_LOGS_ALLOWED_METHODS = ["POST"] as const;
const RUNTIME_EVENT_LOGS_COLLECTION_ROUTE_PATH = "/api/runtime/event-logs";

export function handleRuntimeEventLogCollectionLoader(): Response {
  installGlobalServerErrorLogging();
  return methodNotAllowedResponse(APP_EVENT_LOGS_ALLOWED_METHODS);
}

export async function handleRuntimeEventLogCollectionAction(options: {
  request: Request;
}): Promise<Response> {
  const { request } = options;
  installGlobalServerErrorLogging();

  if (request.method !== "POST") {
    return methodNotAllowedResponse(APP_EVENT_LOGS_ALLOWED_METHODS);
  }

  const payload = await readJsonPayload(request);
  if (!payload.ok) {
    await logServerRouteEvent({
      request,
      route: RUNTIME_EVENT_LOGS_COLLECTION_ROUTE_PATH,
      eventName: "invalid_json_body",
      action: "parse_request_body",
      level: "warning",
      statusCode: 400,
      message: "Invalid JSON body.",
    });
    return invalidJsonResponse();
  }

  const parsed = readClientRuntimeEventLogPayload(payload.value);
  if (!parsed) {
    await logServerRouteEvent({
      request,
      route: RUNTIME_EVENT_LOGS_COLLECTION_ROUTE_PATH,
      eventName: "invalid_client_event_payload",
      action: "validate_payload",
      level: "warning",
      statusCode: 422,
      message: "Client event payload is invalid.",
      context: {
        payloadType: typeof payload.value,
      },
    });

    return validationErrorResponse(
      "invalid_event_log_payload",
      "Invalid event log payload.",
    );
  }

  const identity = await readAzureArmUserContext();
  const eventLogId = await logRuntimeEventWithId({
    source: "client",
    level: parsed.level,
    category: parsed.category,
    eventName: parsed.eventName,
    message: parsed.message,
    errorName: parsed.errorName,
    location: parsed.location,
    action: parsed.action,
    statusCode: parsed.statusCode,
    httpMethod: request.method,
    httpPath: new URL(request.url).pathname,
    threadId: parsed.threadId,
    tenantId: identity?.tenantId,
    principalId: identity?.principalId,
    stack: parsed.stack,
    context: {
      ...(isRecord(parsed.context)
        ? parsed.context
        : { value: parsed.context ?? null }),
      userAgent: request.headers.get("user-agent") ?? "",
      referer: request.headers.get("referer") ?? "",
    },
  });

  if (!eventLogId) {
    await logServerRouteEvent({
      request,
      route: RUNTIME_EVENT_LOGS_COLLECTION_ROUTE_PATH,
      eventName: "create_client_event_log_failed",
      action: "create_client_event_log",
      statusCode: 500,
      message: "Failed to persist runtime event log.",
    });
    return errorResponse({
      status: 500,
      code: "create_client_event_log_failed",
      error: "Failed to persist runtime event log.",
    });
  }

  return Response.json(
    {
      ok: true,
      eventLogId,
    },
    {
      status: 201,
      headers: {
        Location: `/api/runtime/event-logs/${encodeURIComponent(eventLogId)}`,
      },
    },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
