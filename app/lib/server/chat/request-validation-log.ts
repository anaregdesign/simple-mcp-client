/**
 * Server chat request validation log helpers.
 */
import { logServerRouteEvent } from "~/lib/server/observability/runtime-event-log";
import type { ChatRequestValidationError } from "~/lib/server/chat/request-parser";

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
