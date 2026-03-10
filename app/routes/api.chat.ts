/**
 * API route module for /api/chat.
 */
import type { Route } from "./+types/api.chat";
import {
  readAuthenticatedWorkspaceUser,
} from "~/lib/server/infrastructure/auth/read-authenticated-user";
import {
  authRequiredResponse,
} from "~/lib/server/infrastructure/http/route-transport";
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

  const user = await readAuthenticatedWorkspaceUser();
  if (!user) {
    return authRequiredResponse();
  }

  return handleChatAction({
    request,
    user,
  });
}
