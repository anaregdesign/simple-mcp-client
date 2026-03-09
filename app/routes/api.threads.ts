/**
 * API route module for /api/threads.
 */
import { DEFAULT_AGENT_INSTRUCTION } from "~/lib/constants/chat";
import { readThreadWritePayloadFromUnknown } from "~/lib/contracts/threads/parsers";
import type { ThreadWritePayload } from "~/lib/contracts/threads/types";
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
      context: {
        threadCount: threads.length,
        archivedThreadCount: threads.filter((thread) => thread.deletedAt !== null).length,
      },
    });

    return Response.json({ threads });
  } catch (error) {
    await logServerRouteEvent({
      request,
      route: "/api/threads",
      eventName: "load_threads_failed",
      action: "load_threads",
      statusCode: 500,
      error,
      userId: user.id,
    });

    return errorResponse({
      status: 500,
      code: "load_threads_failed",
      error: `Failed to load threads from database: ${readErrorMessage(error)}`,
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

  const thread = readThreadWritePayloadFromUnknown(payload.value, {
    fallbackInstruction: DEFAULT_AGENT_INSTRUCTION,
  });
  if (!thread) {
    await logServerRouteEvent({
      request,
      route: "/api/threads",
      eventName: "invalid_thread_payload",
      action: "read_thread_snapshot",
      level: "warning",
      statusCode: 422,
      message: "Invalid thread payload.",
      userId: user.id,
    });

    return validationErrorResponse("invalid_thread_payload", "Invalid thread payload.");
  }

  try {
    const created = await threadCollectionActionHandlers.createThread(user.id, thread);
    if (created.status === "conflict") {
      await logServerRouteEvent({
        request,
        route: "/api/threads",
        eventName: "thread_conflict",
        action: "create_thread",
        level: "warning",
        statusCode: 409,
        message: "Thread id already exists.",
        userId: user.id,
        threadId: thread.id,
      });

      return errorResponse({
        status: 409,
        code: "thread_conflict",
        error: "Thread id already exists.",
      });
    }

    if (created.status === "invalid") {
      await logServerRouteEvent({
        request,
        route: "/api/threads",
        eventName: "invalid_thread_payload",
        action: "create_thread",
        level: "warning",
        statusCode: 422,
        message: "Thread payload is not persistable.",
        userId: user.id,
        threadId: thread.id,
      });

      return validationErrorResponse(
        "invalid_thread_payload",
        "Thread payload is not persistable.",
      );
    }

    await logServerRouteEvent({
      request,
      route: "/api/threads",
      eventName: "create_thread_succeeded",
      action: "create_thread",
      level: "info",
      statusCode: 201,
      message: "Thread created.",
      userId: user.id,
      threadId: created.thread.id,
      context: {
        messageCount: created.thread.messages.length,
        mcpServerCount: created.thread.mcpServers.length,
        operationLogCount: created.thread.mcpRpcLogs.length,
        skillSelectionCount: created.thread.skillSelections.length,
      },
    });

    return Response.json(
      { thread: created.thread },
      {
        status: 201,
        headers: {
          Location: `/api/threads/${encodeURIComponent(created.thread.id)}`,
        },
      },
    );
  } catch (error) {
    await logServerRouteEvent({
      request,
      route: "/api/threads",
      eventName: "create_thread_failed",
      action: "create_thread",
      statusCode: 500,
      error,
      userId: user.id,
      threadId: thread.id,
    });

    return errorResponse({
      status: 500,
      code: "create_thread_failed",
      error: `Failed to create thread in database: ${readErrorMessage(error)}`,
    });
  }
}
