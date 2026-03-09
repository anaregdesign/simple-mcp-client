/**
 * Server chat request validation log helpers.
 */
import type { ChatRequestValidationError } from "~/lib/server/infrastructure/gateways/chat/request-parser";
import { logServerRouteEvent } from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";

const CHAT_ROUTE_PATH = "/api/chat";

export async function logChatRequestValidationError(
  request: Request,
  error: ChatRequestValidationError,
): Promise<void> {
  await logServerRouteEvent({
    request,
    route: CHAT_ROUTE_PATH,
    eventName: error.eventName,
    action: error.statusCode === 400 ? "parse_request_body" : "validate_payload",
    level: "warning",
    statusCode: error.statusCode,
    message: error.message,
  });
}
