/**
 * API route module for /api/threads/:threadId.
 */
import {
  authRequiredResponse,
  errorResponse,
  invalidJsonResponse,
  methodNotAllowedResponse,
  validationErrorResponse,
} from "~/lib/server/http";
import {
  installGlobalServerErrorLogging,
  logServerRouteEvent,
} from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import {
  createThreadApplicationService,
} from "~/lib/server/usecase/threads/thread-service";
import { readAuthenticatedUser } from "~/lib/server/infrastructure/auth/read-authenticated-user";
import {
  createThreadPersistenceRepository,
} from "~/lib/server/infrastructure/repositories/thread-persistence-repository";
import { readErrorMessage, readJsonPayload } from "~/lib/server/http";
import {
  describeUnexpectedThreadFailure,
  presentDeleteThreadResult,
  presentRestoreThreadResult,
  presentUpdateThreadResult,
} from "~/lib/server/http/threads/thread-route-presentation";
import {
  ensureThreadPayloadMatchesPath,
  readThreadIdParam,
  readThreadRestoreRequest,
  readThreadWritePayload,
} from "~/lib/server/http/threads/thread-route-parsing";
import type { Route } from "./+types/api.threads.$threadId";

const THREAD_ITEM_ALLOWED_METHODS = ["PUT", "PATCH", "DELETE"] as const;

function getThreadApplicationService() {
  return createThreadApplicationService(createThreadPersistenceRepository());
}

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

  const threadId = readThreadIdParam(params.threadId);
  if (!threadId.ok) {
    await logServerRouteEvent({
      request,
      route: "/api/threads/:threadId",
      eventName: threadId.issue.eventName,
      action: threadId.issue.action,
      level: "warning",
      statusCode: threadId.issue.statusCode,
      message: threadId.issue.message,
      userId: user.id,
    });

    return validationErrorResponse(threadId.issue.code, threadId.issue.error);
  }

  try {
    if (request.method === "PUT") {
      const payload = await readJsonPayload(request);
      if (!payload.ok) {
        await logServerRouteEvent({
          request,
          route: "/api/threads/:threadId",
          eventName: "invalid_json_body",
          action: "parse_request_body",
          level: "warning",
          statusCode: 400,
          message: "Invalid JSON body.",
          userId: user.id,
          threadId: threadId.value,
        });

        return invalidJsonResponse();
      }

      const thread = readThreadWritePayload(payload.value);
      if (!thread.ok) {
        await logServerRouteEvent({
          request,
          route: "/api/threads/:threadId",
          eventName: thread.issue.eventName,
          action: thread.issue.action,
          level: "warning",
          statusCode: thread.issue.statusCode,
          message: thread.issue.message,
          userId: user.id,
          threadId: threadId.value,
        });

        return validationErrorResponse(thread.issue.code, thread.issue.error);
      }

      const mismatchIssue = ensureThreadPayloadMatchesPath(
        threadId.value,
        thread.value.id,
      );
      if (mismatchIssue) {
        await logServerRouteEvent({
          request,
          route: "/api/threads/:threadId",
          eventName: mismatchIssue.eventName,
          action: mismatchIssue.action,
          level: "warning",
          statusCode: mismatchIssue.statusCode,
          message: mismatchIssue.message,
          userId: user.id,
          threadId: threadId.value,
          context: mismatchIssue.context,
        });

        return validationErrorResponse(mismatchIssue.code, mismatchIssue.error);
      }

      const updatedThread = await getThreadApplicationService().updateThread(
        user.id,
        thread.value,
      );
      const presentation = presentUpdateThreadResult(updatedThread);
      if (presentation.kind === "error") {
        await logServerRouteEvent({
          request,
          route: "/api/threads/:threadId",
          eventName: presentation.eventName,
          action: presentation.action,
          level: presentation.level,
          statusCode: presentation.statusCode,
          message: presentation.message,
          userId: user.id,
          threadId: threadId.value,
        });

        return errorResponse({
          status: presentation.statusCode,
          code: presentation.code,
          error: presentation.error,
        });
      }

      await logServerRouteEvent({
        request,
        route: "/api/threads/:threadId",
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
        { status: presentation.statusCode },
      );
    }

    if (request.method === "DELETE") {
      const deleted = await getThreadApplicationService().logicalDeleteThread(
        user.id,
        threadId.value,
      );
      const presentation = presentDeleteThreadResult(deleted);
      if (presentation.kind === "error") {
        await logServerRouteEvent({
          request,
          route: "/api/threads/:threadId",
          eventName: presentation.eventName,
          action: presentation.action,
          level: presentation.level,
          statusCode: presentation.statusCode,
          message: presentation.message,
          userId: user.id,
          threadId: threadId.value,
        });

        return errorResponse({
          status: presentation.statusCode,
          code: presentation.code,
          error: presentation.error,
        });
      }

      await logServerRouteEvent({
        request,
        route: "/api/threads/:threadId",
        eventName: presentation.eventName,
        action: presentation.action,
        level: presentation.level,
        statusCode: presentation.statusCode,
        message: presentation.message,
        userId: user.id,
        threadId: presentation.thread.id,
      });
      return Response.json({ thread: presentation.thread });
    }

    const payload = await readJsonPayload(request);
    if (!payload.ok) {
      await logServerRouteEvent({
        request,
        route: "/api/threads/:threadId",
        eventName: "invalid_json_body",
        action: "parse_request_body",
        level: "warning",
        statusCode: 400,
        message: "Invalid JSON body.",
        userId: user.id,
        threadId: threadId.value,
      });

      return invalidJsonResponse();
    }

    const restoreRequest = readThreadRestoreRequest(payload.value);
    if (!restoreRequest.ok) {
      await logServerRouteEvent({
        request,
        route: "/api/threads/:threadId",
        eventName: restoreRequest.issue.eventName,
        action: restoreRequest.issue.action,
        level: "warning",
        statusCode: restoreRequest.issue.statusCode,
        message: restoreRequest.issue.message,
        userId: user.id,
        threadId: threadId.value,
      });

      return validationErrorResponse(
        restoreRequest.issue.code,
        restoreRequest.issue.error,
      );
    }

    const restored = await getThreadApplicationService().logicalRestoreThread(
      user.id,
      threadId.value,
    );
    const presentation = presentRestoreThreadResult(restored);
    if (presentation.kind === "error") {
      await logServerRouteEvent({
        request,
        route: "/api/threads/:threadId",
        eventName: presentation.eventName,
        action: presentation.action,
        level: presentation.level,
        statusCode: presentation.statusCode,
        message: presentation.message,
        userId: user.id,
        threadId: threadId.value,
      });

      return errorResponse({
        status: presentation.statusCode,
        code: presentation.code,
        error: presentation.error,
      });
    }

    await logServerRouteEvent({
      request,
      route: "/api/threads/:threadId",
      eventName: presentation.eventName,
      action: presentation.action,
      level: presentation.level,
      statusCode: presentation.statusCode,
      message: presentation.message,
      userId: user.id,
      threadId: presentation.thread.id,
    });
    return Response.json({ thread: presentation.thread });
  } catch (error) {
    const failure = describeUnexpectedThreadFailure(
      request.method === "PUT"
        ? "update_thread"
        : request.method === "DELETE"
          ? "delete_thread"
          : "restore_thread",
    );

    await logServerRouteEvent({
      request,
      route: "/api/threads/:threadId",
      eventName: failure.eventName,
      action: failure.action,
      statusCode: 500,
      error,
      userId: user.id,
      threadId: threadId.value,
    });

    return errorResponse({
      status: 500,
      code: failure.code,
      error: `${failure.message}: ${readErrorMessage(error)}`,
    });
  }
}
