import { logServerRouteEvent } from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import {
  errorResponse,
  invalidJsonResponse,
  methodNotAllowedResponse,
  validationErrorResponse,
} from "~/lib/server/infrastructure/http/route-transport";
import { buildChatUpstreamErrorPayload } from "~/lib/server/infrastructure/chat/chat-upstream-error";
import { chatExecutionDependencies } from "~/lib/server/infrastructure/gateways/chat/chat-execution-dependencies";
import { createJsonEventStreamResponse } from "~/lib/server/infrastructure/gateways/chat/json-event-stream";
import {
  readOptionalRequestHeaderValue,
  readWebSearchUserLocationFromRequest,
  wantsEventStream,
} from "~/lib/server/infrastructure/gateways/chat/request-metadata";
import { parseChatRequest } from "~/lib/server/infrastructure/gateways/chat/request-parser";
import { logChatRequestValidationError } from "~/lib/server/infrastructure/gateways/chat/request-validation-log";
import { createThreadPersistenceRepository } from "~/lib/server/infrastructure/repositories/thread-persistence-repository";
import {
  executeThreadChatRun,
  isThreadChatRunError,
} from "~/lib/server/usecase/chat/thread-chat-run";

const CHAT_ALLOWED_METHODS = ["POST"] as const;
const CHAT_ROUTE_PATH = "/api/chat";

type ChatStreamPayload =
  | {
      type: "progress";
      message: string;
      isMcp?: boolean;
    }
  | {
      type: "operation_log";
      record: unknown;
    }
  | {
      type: "final";
      assistantMessage: unknown;
      threadEnvironment: Record<string, string>;
    }
  | {
      type: "error";
      error: string;
      errorCode?: "azure_login_required";
    };

export function handleChatLoader(): Response {
  return methodNotAllowedResponse(CHAT_ALLOWED_METHODS);
}

export async function handleChatAction(options: {
  request: Request;
  user: {
    id: number;
  };
}): Promise<Response> {
  const { request, user } = options;

  if (request.method !== "POST") {
    return methodNotAllowedResponse(CHAT_ALLOWED_METHODS);
  }

  const requestParseResult = await parseChatRequest(request);
  if (!requestParseResult.ok) {
    await logChatRequestValidationError(request, requestParseResult.error);
    if (requestParseResult.error.statusCode === 400) {
      return invalidJsonResponse();
    }

    return validationErrorResponse(
      requestParseResult.error.code,
      requestParseResult.error.message,
    );
  }

  const { threadId, turnId } = requestParseResult.value;
  const streamRequested = wantsEventStream(request);
  await logServerRouteEvent({
    request,
    route: CHAT_ROUTE_PATH,
    eventName: streamRequested
      ? "chat_stream_request_received"
      : "chat_request_received",
    action: streamRequested ? "stream_chat" : "execute_chat",
    level: "info",
    statusCode: 200,
    message: "Chat request received.",
    threadId,
    userId: user.id,
    context: {
      turnId,
    },
  });

  if (streamRequested) {
    return streamChatResponse({
      request,
      userId: user.id,
      threadId,
      turnId,
    });
  }

  try {
    const result = await executeThreadChatRun(
      {
        userId: user.id,
        threadId,
        turnId,
        requestOrigin: new URL(request.url).origin,
        clientUserAgent: readOptionalRequestHeaderValue(request, "user-agent"),
        clientPlatform: readOptionalRequestHeaderValue(
          request,
          "sec-ch-ua-platform",
        ),
        webSearchUserLocation: readWebSearchUserLocationFromRequest(request),
      },
      {
        threadRepository: createThreadPersistenceRepository(),
        chatExecutionDependencies,
      },
    );
    await logServerRouteEvent({
      request,
      route: CHAT_ROUTE_PATH,
      eventName: "chat_execution_succeeded",
      action: "execute_chat",
      level: "info",
      statusCode: 200,
      message: "Chat request completed.",
      threadId,
      userId: user.id,
      context: {
        turnId,
        operationLogCount: result.operationLogCount,
      },
    });
    return Response.json({
      assistantMessage: result.assistantMessage,
      threadEnvironment: result.threadEnvironment,
    });
  } catch (error) {
    if (isThreadChatRunError(error)) {
      await logServerRouteEvent({
        request,
        route: CHAT_ROUTE_PATH,
        eventName: error.code,
        action: "execute_chat",
        level: error.status === 404 ? "info" : "warning",
        statusCode: error.status,
        message: error.message,
        threadId,
        userId: user.id,
        context: {
          turnId,
        },
      });

      return error.status === 422
        ? validationErrorResponse(error.code, error.message)
        : errorResponse({
            status: error.status,
            code: error.code,
            error: error.message,
          });
    }

    const upstreamError = buildChatUpstreamErrorPayload(error, "unknown");
    await logServerRouteEvent({
      request,
      route: CHAT_ROUTE_PATH,
      eventName: "chat_execution_failed",
      action: "execute_chat",
      statusCode: upstreamError.status,
      error,
      threadId,
      userId: user.id,
      context: {
        turnId,
      },
    });

    return errorResponse({
      status: upstreamError.status,
      code: upstreamError.payload.code,
      error: upstreamError.payload.error,
      extras: upstreamError.payload.errorCode
        ? {
            errorCode: upstreamError.payload.errorCode,
          }
        : undefined,
    });
  }
}

function streamChatResponse(options: {
  request: Request;
  userId: number;
  threadId: string;
  turnId: string;
}): Response {
  return createJsonEventStreamResponse(async ({ send, signal }) => {
    const sendPayload = (payload: ChatStreamPayload) => {
      send(payload);
    };

    try {
      sendPayload({
        type: "progress",
        message: "Preparing request...",
      });

      const result = await executeThreadChatRun(
        {
          userId: options.userId,
          threadId: options.threadId,
          turnId: options.turnId,
          requestOrigin: new URL(options.request.url).origin,
          clientUserAgent: readOptionalRequestHeaderValue(
            options.request,
            "user-agent",
          ),
          clientPlatform: readOptionalRequestHeaderValue(
            options.request,
            "sec-ch-ua-platform",
          ),
          webSearchUserLocation: readWebSearchUserLocationFromRequest(
            options.request,
          ),
        },
        {
          threadRepository: createThreadPersistenceRepository(),
          chatExecutionDependencies,
        },
        (event) => {
          if (event.type === "progress") {
            sendPayload({
              type: "progress",
              message: event.message,
              ...(event.isMcp ? { isMcp: true } : {}),
            });
            return;
          }

          sendPayload({
            type: "operation_log",
            record: event.record,
          });
        },
        signal,
      );

      sendPayload({
        type: "final",
        assistantMessage: result.assistantMessage,
        threadEnvironment: result.threadEnvironment,
      });
      await logServerRouteEvent({
        route: CHAT_ROUTE_PATH,
        eventName: "chat_stream_execution_succeeded",
        action: "stream_chat",
        level: "info",
        statusCode: 200,
        message: "Chat stream completed.",
        threadId: options.threadId,
        userId: options.userId,
        context: {
          turnId: options.turnId,
          operationLogCount: result.operationLogCount,
        },
      });
    } catch (error) {
      if (isThreadChatRunError(error)) {
        sendPayload({
          type: "error",
          error: error.message,
        });
        return;
      }

      const upstreamError = buildChatUpstreamErrorPayload(error, "unknown");
      await logServerRouteEvent({
        route: CHAT_ROUTE_PATH,
        eventName: "chat_stream_execution_failed",
        action: "stream_chat",
        statusCode: upstreamError.status,
        error,
        threadId: options.threadId,
        userId: options.userId,
        context: {
          turnId: options.turnId,
        },
      });

      sendPayload({
        type: "error",
        error: upstreamError.payload.error,
        ...(upstreamError.payload.errorCode
          ? { errorCode: upstreamError.payload.errorCode }
          : {}),
      });
    }
  });
}
