/**
 * API route module for /api/chat.
 */
import type { Route } from "./+types/api.chat";
import {
  installGlobalServerErrorLogging,
} from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import {
  handleChatAction,
  handleChatLoader,
} from "~/lib/server/infrastructure/chat/chat-action";

export function loader({}: Route.LoaderArgs) {
  installGlobalServerErrorLogging();
  return handleChatLoader();
}

export async function action({ request }: Route.ActionArgs) {
  installGlobalServerErrorLogging();
  return handleChatAction({
    request,
  });
}
