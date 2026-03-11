/**
 * API route module for /api/threads.
 */
import {
  authRequiredResponse,
  methodNotAllowedResponse,
} from "~/lib/server/infrastructure/http/route-transport";
import { readAuthenticatedUser } from "~/lib/server/infrastructure/auth/read-authenticated-user";
import {
  installGlobalServerErrorLogging,
} from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import {
  handleThreadCollectionAction,
  handleThreadCollectionLoader,
} from "~/lib/server/infrastructure/threads/thread-collection-action";
import {
  createThreadServicesWithInfrastructure,
} from "~/lib/server/infrastructure/threads/thread-service-factory";
import type { Route } from "./+types/api.threads";

const THREADS_COLLECTION_ALLOWED_METHODS = ["GET", "POST"] as const;

export async function loader({ request }: Route.LoaderArgs) {
  installGlobalServerErrorLogging();

  if (request.method !== "GET") {
    return methodNotAllowedResponse(THREADS_COLLECTION_ALLOWED_METHODS);
  }

  const user = await readAuthenticatedUser();
  if (!user) {
    return authRequiredResponse();
  }

  return await handleThreadCollectionLoader({
    request,
    userId: user.id,
    threadQueryService: createThreadServicesWithInfrastructure().threadQueryService,
  });
}

export async function action({ request }: Route.ActionArgs) {
  installGlobalServerErrorLogging();

  if (request.method !== "POST") {
    return methodNotAllowedResponse(THREADS_COLLECTION_ALLOWED_METHODS);
  }

  const user = await readAuthenticatedUser();
  if (!user) {
    return authRequiredResponse();
  }

  return await handleThreadCollectionAction({
    request,
    userId: user.id,
    threadApplicationService:
      createThreadServicesWithInfrastructure().threadApplicationService,
  });
}
