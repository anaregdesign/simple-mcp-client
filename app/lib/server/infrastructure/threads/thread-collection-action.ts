import {
  errorResponse,
  invalidJsonResponse,
  readErrorMessage,
  readJsonPayload,
  validationErrorResponse,
} from "~/lib/server/infrastructure/http/route-transport";
import {
  buildThreadCollectionMetricsContext,
  describeUnexpectedThreadFailure,
  presentCreateThreadResult,
  type ThreadRoutePresentation,
} from "~/lib/server/infrastructure/threads/thread-route-presentation";
import { presentThreadResources } from "~/lib/server/infrastructure/threads/thread-resource-presentation";
import {
  readThreadWritePayload,
  type ThreadRouteValidationIssue,
} from "~/lib/server/infrastructure/threads/thread-route-parsing";
import { logServerRouteEvent } from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import type {
  ThreadApplicationService,
  ThreadQueryService,
} from "~/lib/server/usecase/threads/thread-service";

const THREADS_COLLECTION_ROUTE_PATH = "/api/threads";

export async function handleThreadCollectionLoader(options: {
  request: Request;
  userId: number;
  threadQueryService: ThreadQueryService;
}): Promise<Response> {
  const { request, userId, threadQueryService } = options;

  try {
    const threads = await threadQueryService.readUserThreads(userId);
    await logServerRouteEvent({
      request,
      route: THREADS_COLLECTION_ROUTE_PATH,
      eventName: "load_threads_succeeded",
      action: "load_threads",
      level: "info",
      statusCode: 200,
      message: "Threads loaded.",
      userId,
      context: buildThreadCollectionMetricsContext(threads),
    });

    return Response.json({ threads: presentThreadResources(threads) });
  } catch (error) {
    const failure = describeUnexpectedThreadFailure("load_threads");
    await logServerRouteEvent({
      request,
      route: THREADS_COLLECTION_ROUTE_PATH,
      eventName: failure.eventName,
      action: failure.action,
      statusCode: 500,
      error,
      userId,
    });

    return errorResponse({
      status: 500,
      code: failure.code,
      error: `${failure.message}: ${readErrorMessage(error)}`,
    });
  }
}

export async function handleThreadCollectionAction(options: {
  request: Request;
  userId: number;
  threadApplicationService: ThreadApplicationService;
}): Promise<Response> {
  const { request, userId, threadApplicationService } = options;
  const payload = await readJsonPayload(request);
  if (!payload.ok) {
    await logInvalidJsonBody({ request, userId });
    return invalidJsonResponse();
  }

  const thread = readThreadWritePayload(payload.value);
  if (!thread.ok) {
    await logThreadValidationIssue({
      request,
      userId,
      issue: thread.issue,
    });
    return validationErrorResponse(thread.issue.code, thread.issue.error);
  }

  try {
    const created = await threadApplicationService.createThread(
      userId,
      thread.value,
    );
    const presentation = presentCreateThreadResult(created);
    return await respondWithCollectionCreatePresentation({
      request,
      userId,
      threadId: thread.value.id,
      presentation,
    });
  } catch (error) {
    const failure = describeUnexpectedThreadFailure("create_thread");
    await logServerRouteEvent({
      request,
      route: THREADS_COLLECTION_ROUTE_PATH,
      eventName: failure.eventName,
      action: failure.action,
      statusCode: 500,
      error,
      userId,
      threadId: thread.value.id,
    });

    return errorResponse({
      status: 500,
      code: failure.code,
      error: `${failure.message}: ${readErrorMessage(error)}`,
    });
  }
}

async function respondWithCollectionCreatePresentation(options: {
  request: Request;
  userId: number;
  threadId: string;
  presentation: ThreadRoutePresentation;
}): Promise<Response> {
  const { request, userId, threadId, presentation } = options;

  if (presentation.kind === "error") {
    await logServerRouteEvent({
      request,
      route: THREADS_COLLECTION_ROUTE_PATH,
      eventName: presentation.eventName,
      action: presentation.action,
      level: presentation.level,
      statusCode: presentation.statusCode,
      message: presentation.message,
      userId,
      threadId,
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
    route: THREADS_COLLECTION_ROUTE_PATH,
    eventName: presentation.eventName,
    action: presentation.action,
    level: presentation.level,
    statusCode: presentation.statusCode,
    message: presentation.message,
    userId,
    threadId: presentation.thread.id,
    ...(presentation.context ? { context: presentation.context } : {}),
  });

  return Response.json(
    { thread: presentation.thread },
    {
      status: presentation.statusCode,
      headers: presentation.headers,
    },
  );
}

async function logInvalidJsonBody(options: {
  request: Request;
  userId: number;
}): Promise<void> {
  const { request, userId } = options;
  await logServerRouteEvent({
    request,
    route: THREADS_COLLECTION_ROUTE_PATH,
    eventName: "invalid_json_body",
    action: "parse_request_body",
    level: "warning",
    statusCode: 400,
    message: "Invalid JSON body.",
    userId,
  });
}

async function logThreadValidationIssue(options: {
  request: Request;
  userId: number;
  issue: ThreadRouteValidationIssue;
}): Promise<void> {
  const { request, userId, issue } = options;
  await logServerRouteEvent({
    request,
    route: THREADS_COLLECTION_ROUTE_PATH,
    eventName: issue.eventName,
    action: issue.action,
    level: "warning",
    statusCode: issue.statusCode,
    message: issue.message,
    userId,
  });
}
