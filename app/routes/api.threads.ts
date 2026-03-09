/**
 * API route module for /api/threads.
 */
import type { ThreadWritePayload } from "~/lib/domain/entities/thread-record";
import {
  createThreadApplicationService,
  createThreadQueryService,
  type CreateThreadResult,
} from "~/lib/server/usecase/threads/thread-service";
import {
  createThreadPersistenceRepository,
} from "~/lib/server/infrastructure/repositories/thread-persistence-repository";
import {
  authRequiredResponse,
  errorResponse,
  invalidJsonResponse,
  methodNotAllowedResponse,
  readJsonPayload,
  readErrorMessage,
  validationErrorResponse,
} from "~/lib/server/http";
import { readAuthenticatedUser } from "~/lib/server/infrastructure/auth/read-authenticated-user";
import {
  installGlobalServerErrorLogging,
  logServerRouteEvent,
} from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import {
  describeUnexpectedThreadFailure,
  buildThreadCollectionMetricsContext,
  presentCreateThreadResult,
} from "~/lib/server/usecase/threads/thread-route-presentation";
import { readThreadWritePayload } from "~/lib/server/usecase/threads/thread-route-parsing";
import type { Route } from "./+types/api.threads";

const THREADS_COLLECTION_ALLOWED_METHODS = ["GET", "POST"] as const;

function getThreadServices() {
  const repository = createThreadPersistenceRepository();
  return {
    threadApplicationService: createThreadApplicationService(repository),
    threadQueryService: createThreadQueryService(repository),
  };
}

export const threadCollectionActionHandlers = {
  createThread: (
    userId: number,
    payload: ThreadWritePayload,
  ): Promise<CreateThreadResult> =>
    getThreadServices().threadApplicationService.createThread(userId, payload),
};

export async function loader({ request }: Route.LoaderArgs) {
  installGlobalServerErrorLogging();

  if (request.method !== "GET") {
    return methodNotAllowedResponse(THREADS_COLLECTION_ALLOWED_METHODS);
  }

  const user = await readAuthenticatedUser();
  if (!user) {
    return authRequiredResponse();
  }

  try {
    const threads = await getThreadServices().threadQueryService.readUserThreads(
      user.id,
    );
    await logServerRouteEvent({
      request,
      route: "/api/threads",
      eventName: "load_threads_succeeded",
      action: "load_threads",
      level: "info",
      statusCode: 200,
      message: "Threads loaded.",
      userId: user.id,
      context: buildThreadCollectionMetricsContext(threads),
    });

    return Response.json({ threads });
  } catch (error) {
    const failure = describeUnexpectedThreadFailure("load_threads");
    await logServerRouteEvent({
      request,
      route: "/api/threads",
      eventName: failure.eventName,
      action: failure.action,
      statusCode: 500,
      error,
      userId: user.id,
    });

    return errorResponse({
      status: 500,
      code: failure.code,
      error: `${failure.message}: ${readErrorMessage(error)}`,
    });
  }
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

  const payload = await readJsonPayload(request);
  if (!payload.ok) {
    await logServerRouteEvent({
      request,
      route: "/api/threads",
      eventName: "invalid_json_body",
      action: "parse_request_body",
      level: "warning",
      statusCode: 400,
      message: "Invalid JSON body.",
      userId: user.id,
    });

    return invalidJsonResponse();
  }

  const thread = readThreadWritePayload(payload.value);
  if (!thread.ok) {
    await logServerRouteEvent({
      request,
      route: "/api/threads",
      eventName: thread.issue.eventName,
      action: thread.issue.action,
      level: "warning",
      statusCode: thread.issue.statusCode,
      message: thread.issue.message,
      userId: user.id,
    });

    return validationErrorResponse(thread.issue.code, thread.issue.error);
  }

  try {
    const created = await threadCollectionActionHandlers.createThread(
      user.id,
      thread.value,
    );
    const presentation = presentCreateThreadResult(created);
    if (presentation.kind === "error") {
      await logServerRouteEvent({
        request,
        route: "/api/threads",
        eventName: presentation.eventName,
        action: presentation.action,
        level: presentation.level,
        statusCode: presentation.statusCode,
        message: presentation.message,
        userId: user.id,
        threadId: thread.value.id,
      });

      return presentation.statusCode === 422
        ? validationErrorResponse(presentation.code, presentation.error)
        : errorResponse({
            status: presentation.statusCode,
            code: presentation.code,
            error: presentation.error,
          });
    }

    await logServerRouteEvent({
      request,
      route: "/api/threads",
      eventName: presentation.eventName,
      action: presentation.action,
      level: presentation.level,
      statusCode: presentation.statusCode,
      message: presentation.message,
      userId: user.id,
      threadId: presentation.thread.id,
      context: presentation.context,
    });

    return Response.json(
      { thread: presentation.thread },
      {
        status: presentation.statusCode,
        headers: presentation.headers,
      },
    );
  } catch (error) {
    const failure = describeUnexpectedThreadFailure("create_thread");
    await logServerRouteEvent({
      request,
      route: "/api/threads",
      eventName: failure.eventName,
      action: failure.action,
      statusCode: 500,
      error,
      userId: user.id,
      threadId: thread.value.id,
    });

    return errorResponse({
      status: 500,
      code: failure.code,
      error: `${failure.message}: ${readErrorMessage(error)}`,
    });
  }
}
