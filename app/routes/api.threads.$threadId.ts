/**
 * API route module for /api/threads/:threadId.
 */
import {
  authRequiredResponse,
  methodNotAllowedResponse,
} from "~/lib/server/infrastructure/http/route-transport";
import {
  installGlobalServerErrorLogging,
} from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import { readAuthenticatedUser } from "~/lib/server/infrastructure/auth/read-authenticated-user";
import { handleThreadItemMutationAction } from "~/lib/server/infrastructure/threads/thread-item-action";
import {
  createThreadApplicationServiceWithInfrastructure,
} from "~/lib/server/infrastructure/threads/thread-service-factory";
import type { Route } from "./+types/api.threads.$threadId";

const THREAD_ITEM_ALLOWED_METHODS = ["PUT", "PATCH", "DELETE"] as const;

export function loader() {
  installGlobalServerErrorLogging();
  return methodNotAllowedResponse(THREAD_ITEM_ALLOWED_METHODS);
}

export async function action({ request, params }: Route.ActionArgs) {
  installGlobalServerErrorLogging();

  if (
    request.method !== "PUT" &&
    request.method !== "DELETE" &&
    request.method !== "PATCH"
  ) {
    return methodNotAllowedResponse(THREAD_ITEM_ALLOWED_METHODS);
  }

  const user = await readAuthenticatedUser();
  if (!user) {
    return authRequiredResponse();
  }

  return await handleThreadItemMutationAction({
    request,
    userId: user.id,
    threadIdParam: params.threadId,
    threadService: createThreadApplicationServiceWithInfrastructure(),
  });
}
