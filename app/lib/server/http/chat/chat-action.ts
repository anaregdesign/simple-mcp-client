import type {
  ChatExecutionEvent,
  ChatExecutionOptions,
  ChatExecutionResult,
  ThreadOperationLogRecord,
} from "~/lib/server/usecase/chat/chat-execution";
import type { ThreadEnvironment } from "~/lib/contracts/threads/environment";
import {
  CHAT_MAX_RUN_TURNS,
} from "~/lib/constants/chat";
import {
  logServerRouteEvent,
} from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import {
  errorResponse,
  invalidJsonResponse,
  methodNotAllowedResponse,
  validationErrorResponse,
} from "~/lib/server/http";
import {
  buildChatUpstreamErrorPayload,
} from "~/lib/server/http/chat/chat-upstream-error";
import {
  chatExecutionDependencies,
} from "~/lib/server/infrastructure/gateways/chat/chat-execution-dependencies";
import {
  createJsonEventStreamResponse,
} from "~/lib/server/infrastructure/gateways/chat/json-event-stream";
import {
  readOptionalRequestHeaderValue,
  readWebSearchUserLocationFromRequest,
  wantsEventStream,
} from "~/lib/server/infrastructure/gateways/chat/request-metadata";
import {
  parseChatRequest,
} from "~/lib/server/infrastructure/gateways/chat/request-parser";
import {
  logChatRequestValidationError,
} from "~/lib/server/infrastructure/gateways/chat/request-validation-log";
import {
  resolveThreadDirectoryContext,
} from "~/lib/server/infrastructure/gateways/chat/thread-directory-context";
import {
  registerThreadMcpServerSessionPoolShutdownHooks,
} from "~/lib/server/infrastructure/gateways/mcp/thread-mcp-server-session-pool-shutdown";
import {
  buildChatExecutionLogContext,
  buildChatExecutionSuccessLogContext,
} from "~/lib/server/usecase/chat/chat-execution-log-context";
import {
  applyDefaultThreadDirectoryToStdioServers,
} from "~/lib/server/usecase/chat/mcp-server-config-normalization";
import {
  executeChat as executeChatUsecase,
  executeChatWithTransientRetry as executeChatWithTransientRetryUsecase,
  isChatCanceledError,
} from "~/lib/server/usecase/chat/chat-execution";

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
      record: ThreadOperationLogRecord;
    }
  | {
      type: "final";
      message: string;
      threadEnvironment: ThreadEnvironment;
    }
  | {
      type: "error";
      error: string;
      errorCode?: "azure_login_required";
    };

registerThreadMcpServerSessionPoolShutdownHooks();

export function handleChatLoader(): Response {
  return methodNotAllowedResponse(CHAT_ALLOWED_METHODS);
}

export async function handleChatAction(options: {
  request: Request;
}): Promise<Response> {
  const { request } = options;

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

  const {
    threadId,
    turnId,
    message,
    history,
    attachments,
    reasoningEffort,
    webSearchEnabled,
    temperature,
    agentInstruction,
    instructionContextToggles,
    threadEnvironment,
    skills,
    explicitSkillLocations,
    azureConfig,
    mcpServers: requestMcpServers,
  } = requestParseResult.value;
  const webSearchUserLocation = webSearchEnabled
    ? readWebSearchUserLocationFromRequest(request)
    : null;
  const threadDirectoryContext = await resolveThreadDirectoryContext({
    threadId,
    tenantId: azureConfig.tenantId,
  });
  const mcpServers = applyDefaultThreadDirectoryToStdioServers(
    requestMcpServers,
    threadDirectoryContext?.threadDirectoryPath ?? null,
    threadDirectoryContext?.userDirectoryPath ?? null,
  );

  const executionOptions: ChatExecutionOptions = {
    threadId,
    turnId,
    userId: threadDirectoryContext?.userId ?? null,
    clientUserAgent: readOptionalRequestHeaderValue(request, "user-agent"),
    clientPlatform: readOptionalRequestHeaderValue(
      request,
      "sec-ch-ua-platform",
    ),
    message,
    attachments,
    history,
    reasoningEffort,
    webSearchEnabled,
    webSearchUserLocation,
    temperature,
    agentInstruction,
    instructionContextToggles,
    threadEnvironment,
    skills,
    explicitSkillLocations,
    azureConfig,
    mcpServers,
  };
  const logContext = buildChatExecutionLogContext(executionOptions);
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
    context: logContext,
  });

  if (streamRequested) {
    return streamChatResponse(executionOptions);
  }

  try {
    const result = await executeChatWithTransientRetry(executionOptions);
    await logServerRouteEvent({
      request,
      route: CHAT_ROUTE_PATH,
      eventName: "chat_execution_succeeded",
      action: "execute_chat",
      level: "info",
      statusCode: 200,
      message: "Chat request completed.",
      threadId,
      context: buildChatExecutionSuccessLogContext(executionOptions, result),
    });
    return Response.json({
      message: result.message,
      threadEnvironment: result.threadEnvironment,
    });
  } catch (error) {
    const upstreamError = buildChatUpstreamErrorPayload(
      error,
      azureConfig.deploymentName,
    );
    await logServerRouteEvent({
      request,
      route: CHAT_ROUTE_PATH,
      eventName: "chat_execution_failed",
      action: "execute_chat",
      statusCode: upstreamError.status,
      error,
      threadId,
      context: {
        ...logContext,
        maxRunTurns: CHAT_MAX_RUN_TURNS,
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

async function executeChat(
  options: ChatExecutionOptions,
  onEvent?: (event: ChatExecutionEvent) => void,
  abortSignal?: AbortSignal,
): Promise<ChatExecutionResult> {
  return executeChatUsecase(
    options,
    chatExecutionDependencies,
    onEvent,
    abortSignal,
  );
}

async function executeChatWithTransientRetry(
  options: ChatExecutionOptions,
  onEvent?: (event: ChatExecutionEvent) => void,
  abortSignal?: AbortSignal,
): Promise<ChatExecutionResult> {
  return executeChatWithTransientRetryUsecase(
    options,
    chatExecutionDependencies,
    onEvent,
    abortSignal,
  );
}

function streamChatResponse(options: ChatExecutionOptions): Response {
  return createJsonEventStreamResponse(async ({ send, signal }) => {
    const sendPayload = (payload: ChatStreamPayload) => {
      send(payload);
    };

    try {
      sendPayload({
        type: "progress",
        message: "Preparing request...",
      });

      const result = await executeChatWithTransientRetry(
        options,
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
        message: result.message,
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
        context: buildChatExecutionSuccessLogContext(options, result),
      });
    } catch (error) {
      if (signal.aborted || isChatCanceledError(error)) {
        await logServerRouteEvent({
          route: CHAT_ROUTE_PATH,
          eventName: "chat_stream_canceled",
          action: "stream_chat",
          level: "info",
          statusCode: 200,
          message: "Chat stream canceled by client disconnect.",
          threadId: options.threadId,
          context: buildChatExecutionLogContext(options),
        });
        return;
      }

      const upstreamError = buildChatUpstreamErrorPayload(
        error,
        options.azureConfig.deploymentName,
      );
      await logServerRouteEvent({
        route: CHAT_ROUTE_PATH,
        eventName: "chat_stream_execution_failed",
        action: "stream_chat",
        statusCode: upstreamError.status,
        error,
        threadId: options.threadId,
        context: {
          ...buildChatExecutionLogContext(options),
          maxRunTurns: CHAT_MAX_RUN_TURNS,
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
