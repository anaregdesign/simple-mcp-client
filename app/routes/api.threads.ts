/**
 * API route module for /api/threads.
 */
import {
  createThreadApplicationService,
  createThreadQueryService,
} from "~/lib/server/usecase/threads/thread-service";
import {
  createThreadPersistenceRepository,
} from "~/lib/server/infrastructure/repositories/thread-persistence-repository";
import {
  authRequiredResponse,
  methodNotAllowedResponse,
} from "~/lib/server/http";
import { readAuthenticatedUser } from "~/lib/server/infrastructure/auth/read-authenticated-user";
import {
  installGlobalServerErrorLogging,
} from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import {
  handleThreadCollectionAction,
  handleThreadCollectionLoader,
} from "~/lib/server/http/threads/thread-collection-action";
import type { Route } from "./+types/api.threads";

const THREADS_COLLECTION_ALLOWED_METHODS = ["GET", "POST"] as const;

function getThreadServices() {
  const repository = createThreadPersistenceRepository();
  return {
    threadApplicationService: createThreadApplicationService(repository),
    threadQueryService: createThreadQueryService(repository),
  };
}

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
    threadQueryService: getThreadServices().threadQueryService,
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
    threadApplicationService: getThreadServices().threadApplicationService,
  });
}
