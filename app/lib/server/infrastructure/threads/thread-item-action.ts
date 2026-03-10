import {
  errorResponse,
  invalidJsonResponse,
  readErrorMessage,
  readJsonPayload,
  validationErrorResponse,
} from "~/lib/server/infrastructure/http/route-transport";
import {
  describeUnexpectedThreadFailure,
  presentDeleteThreadResult,
  presentRestoreThreadResult,
  presentUpdateThreadResult,
  type ThreadRoutePresentation,
  type ThreadUnexpectedFailureOperation,
} from "~/lib/server/infrastructure/threads/thread-route-presentation";
import {
  ensureThreadPayloadMatchesPath,
  readThreadIdParam,
  readThreadRestoreRequest,
  readThreadWritePayload,
  type ThreadRouteValidationIssue,
} from "~/lib/server/infrastructure/threads/thread-route-parsing";
import { logServerRouteEvent } from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import type { ThreadApplicationService } from "~/lib/server/usecase/threads/thread-service";

const THREAD_ITEM_ROUTE_PATH = "/api/threads/:threadId";

type ThreadItemActionOptions = {
  request: Request;
  userId: number;
  threadIdParam: unknown;
  threadService: ThreadApplicationService;
};

type ThreadMutationLogOptions = {
  request: Request;
  userId: number;
  threadId: string;
};

export async function handleThreadItemMutationAction(
  options: ThreadItemActionOptions,
): Promise<Response> {
  const { request, userId, threadIdParam, threadService } = options;
  const threadId = readThreadIdParam(threadIdParam);
  if (!threadId.ok) {
    await logThreadValidationIssue({
      request,
      userId,
      issue: threadId.issue,
    });
    return validationErrorResponse(threadId.issue.code, threadId.issue.error);
  }

  try {
    if (request.method === "PUT") {
      return await handleThreadUpdateRequest({
        request,
        userId,
        threadId: threadId.value,
        threadService,
      });
    }

    if (request.method === "DELETE") {
      return await handleThreadDeleteRequest({
        request,
        userId,
        threadId: threadId.value,
        threadService,
      });
    }

    return await handleThreadRestoreRequest({
      request,
      userId,
      threadId: threadId.value,
      threadService,
    });
  } catch (error) {
    return await handleUnexpectedThreadItemFailure({
      request,
      userId,
      threadId: threadId.value,
      operation:
        request.method === "PUT"
          ? "update_thread"
          : request.method === "DELETE"
            ? "delete_thread"
            : "restore_thread",
      error,
    });
  }
}

async function handleThreadUpdateRequest(
  options: ThreadMutationLogOptions & {
    threadService: ThreadApplicationService;
  },
): Promise<Response> {
  const { request, userId, threadId, threadService } = options;
  const payload = await readJsonPayload(request);
  if (!payload.ok) {
    await logInvalidJsonBody({ request, userId, threadId });
    return invalidJsonResponse();
  }

  const thread = readThreadWritePayload(payload.value);
  if (!thread.ok) {
    await logThreadValidationIssue({
      request,
      userId,
      threadId,
      issue: thread.issue,
    });
    return validationErrorResponse(thread.issue.code, thread.issue.error);
  }

  const mismatchIssue = ensureThreadPayloadMatchesPath(threadId, thread.value.id);
  if (mismatchIssue) {
    await logThreadValidationIssue({
      request,
      userId,
      threadId,
      issue: mismatchIssue,
    });
    return validationErrorResponse(mismatchIssue.code, mismatchIssue.error);
  }

  const updatedThread = await threadService.updateThread(userId, thread.value);
  const presentation = presentUpdateThreadResult(updatedThread);
  return await respondWithThreadPresentation({
    request,
    userId,
    threadId,
    presentation,
  });
}

async function handleThreadDeleteRequest(
  options: ThreadMutationLogOptions & {
    threadService: ThreadApplicationService;
  },
): Promise<Response> {
  const { request, userId, threadId, threadService } = options;
  const deleted = await threadService.logicalDeleteThread(userId, threadId);
  const presentation = presentDeleteThreadResult(deleted);
  return await respondWithThreadPresentation({
    request,
    userId,
    threadId,
    presentation,
  });
}

async function handleThreadRestoreRequest(
  options: ThreadMutationLogOptions & {
    threadService: ThreadApplicationService;
  },
): Promise<Response> {
  const { request, userId, threadId, threadService } = options;
  const payload = await readJsonPayload(request);
  if (!payload.ok) {
    await logInvalidJsonBody({ request, userId, threadId });
    return invalidJsonResponse();
  }

  const restoreRequest = readThreadRestoreRequest(payload.value);
  if (!restoreRequest.ok) {
    await logThreadValidationIssue({
      request,
      userId,
      threadId,
      issue: restoreRequest.issue,
    });
    return validationErrorResponse(
      restoreRequest.issue.code,
      restoreRequest.issue.error,
    );
  }

  const restored = await threadService.logicalRestoreThread(userId, threadId);
  const presentation = presentRestoreThreadResult(restored);
  return await respondWithThreadPresentation({
    request,
    userId,
    threadId,
    presentation,
  });
}

async function respondWithThreadPresentation(
  options: ThreadMutationLogOptions & {
    presentation: ThreadRoutePresentation;
  },
): Promise<Response> {
  const { request, userId, threadId, presentation } = options;

  if (presentation.kind === "error") {
    await logServerRouteEvent({
      request,
      route: THREAD_ITEM_ROUTE_PATH,
      eventName: presentation.eventName,
      action: presentation.action,
      level: presentation.level,
      statusCode: presentation.statusCode,
      message: presentation.message,
      userId,
      threadId,
    });

    return errorResponse({
      status: presentation.statusCode,
      code: presentation.code,
      error: presentation.error,
    });
  }

  await logServerRouteEvent({
    request,
    route: THREAD_ITEM_ROUTE_PATH,
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

async function logThreadValidationIssue(options: {
  request: Request;
  userId: number;
  issue: ThreadRouteValidationIssue;
  threadId?: string;
}): Promise<void> {
  const { request, userId, issue, threadId } = options;
  await logServerRouteEvent({
    request,
    route: THREAD_ITEM_ROUTE_PATH,
    eventName: issue.eventName,
    action: issue.action,
    level: "warning",
    statusCode: issue.statusCode,
    message: issue.message,
    userId,
    ...(threadId ? { threadId } : {}),
    ...(issue.context ? { context: issue.context } : {}),
  });
}

async function logInvalidJsonBody(
  options: ThreadMutationLogOptions,
): Promise<void> {
  const { request, userId, threadId } = options;
  await logServerRouteEvent({
    request,
    route: THREAD_ITEM_ROUTE_PATH,
    eventName: "invalid_json_body",
    action: "parse_request_body",
    level: "warning",
    statusCode: 400,
    message: "Invalid JSON body.",
    userId,
    threadId,
  });
}

async function handleUnexpectedThreadItemFailure(options: {
  request: Request;
  userId: number;
  threadId: string;
  operation: ThreadUnexpectedFailureOperation;
  error: unknown;
}): Promise<Response> {
  const { request, userId, threadId, operation, error } = options;
  const failure = describeUnexpectedThreadFailure(operation);

  await logServerRouteEvent({
    request,
    route: THREAD_ITEM_ROUTE_PATH,
    eventName: failure.eventName,
    action: failure.action,
    statusCode: 500,
    error,
    userId,
    threadId,
  });

  return errorResponse({
    status: 500,
    code: failure.code,
    error: `${failure.message}: ${readErrorMessage(error)}`,
  });
}
