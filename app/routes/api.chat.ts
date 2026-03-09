/**
 * API route module for /api/chat.
 */
import type { Route } from "./+types/api.chat";
import {
  Agent,
} from "@openai/agents";
import {
  acquireThreadMcpServerSession,
} from "~/lib/server/infrastructure/gateways/mcp/thread-mcp-server-session-pool";
import { registerThreadMcpServerSessionPoolShutdownHooks } from "~/lib/server/infrastructure/gateways/mcp/thread-mcp-server-session-pool-shutdown";
import {
  installGlobalServerErrorLogging,
  logServerRouteEvent,
} from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import {
  errorResponse,
  invalidJsonResponse,
  methodNotAllowedResponse,
  validationErrorResponse,
} from "~/lib/server/http";
import {
  CHAT_ATTACHMENT_ALLOWED_EXTENSIONS,
  CHAT_ATTACHMENT_MAX_FILES,
  CHAT_ATTACHMENT_MAX_FILE_NAME_LENGTH,
  CHAT_ATTACHMENT_MAX_NON_PDF_FILE_SIZE_BYTES,
  CHAT_ATTACHMENT_MAX_PDF_FILE_SIZE_BYTES,
  CHAT_ATTACHMENT_MAX_PDF_TOTAL_SIZE_BYTES,
  CHAT_ATTACHMENT_MAX_TOTAL_SIZE_BYTES,
  CHAT_MAX_IDENTICAL_SKILL_OPERATION_CALLS_PER_SIGNATURE,
  CHAT_MAX_IDENTICAL_SKILL_RUN_SCRIPT_CALLS_PER_SIGNATURE,
  CHAT_MAX_RUN_TURNS,
  CHAT_MAX_SKILL_OPERATION_CALLS_PER_SERVER_METHOD,
  CHAT_MAX_SKILL_RUN_SCRIPT_CALLS_PER_SERVER_METHOD,
} from "~/lib/constants/chat";
import {
  MCP_DEFAULT_AZURE_AUTH_SCOPE,
  MCP_SERVER_NAME_MAX_LENGTH,
} from "~/lib/constants/mcp";
import {
  cloneThreadEnvironment,
} from "~/lib/contracts/threads/environment";
import type { ThreadEnvironment } from "~/lib/contracts/threads/environment";
import type { ThreadInstructionContextToggles } from "~/lib/contracts/threads/instruction-context";
import {
  isDeploymentReasoningEffortCompatible,
  isWebSearchCompatibleReasoningEffort,
  parseChatRequest,
  readAttachments,
  readExplicitSkillLocations,
  readInstructionContextToggles,
  readMcpServers,
  readSkills,
  readTemperature,
  readThreadEnvironment,
  readWebSearchEnabled,
} from "~/lib/server/infrastructure/gateways/chat/request-parser";
import { logChatRequestValidationError } from "~/lib/server/infrastructure/gateways/chat/request-validation-log";
import { createJsonEventStreamResponse } from "~/lib/server/infrastructure/gateways/chat/json-event-stream";
import { cleanupChatRuntime } from "~/lib/server/usecase/chat/chat-runtime-cleanup";
import { prepareMcpRuntime } from "~/lib/server/usecase/chat/chat-mcp-runtime";
import {
  buildMcpConnectParams,
  buildMcpConnectSuccessResponse,
  buildThreadOperationLogRequestId,
  createMcpServerSession,
  instrumentMcpServer,
  type McpServerSessionRefreshState,
  type ThreadOperationLogRecord,
} from "~/lib/server/infrastructure/gateways/mcp/mcp-session-logging";
import {
  buildMcpContextRequestHeaders,
  buildMcpHttpRequestHeaders,
  buildMcpHttpRuntimeHeaders,
  isLocalPlaygroundMcpContextUrl,
  normalizeMcpInitializeNullOptionals,
  normalizeMcpListToolsNullOptionals,
  normalizeMcpMetaNulls,
} from "~/lib/server/infrastructure/gateways/mcp/mcp-http-session-helpers";
import {
  readOptionalRequestHeaderValue,
  readWebSearchUserLocationFromRequest,
  wantsEventStream,
} from "~/lib/server/infrastructure/gateways/chat/request-metadata";
import {
  readProgressEventFromRunStreamEvent,
  type RunStreamProgressEvent,
} from "~/lib/server/infrastructure/gateways/chat/run-stream-progress";
import {
  describeMcpServer,
  getAzureMcpAuthorizationToken,
} from "~/lib/server/infrastructure/gateways/chat/chat-execution-dependencies";
import {
  createCodeInterpreterContainerWithAttachments,
} from "~/lib/server/infrastructure/gateways/chat/code-interpreter-attachment-gateway";
import {
  resolveThreadDirectoryContext,
  resolveThreadDirectoryPath,
} from "~/lib/server/infrastructure/gateways/chat/thread-directory-context";
import { buildSystemInstructionContextPayload } from "~/lib/server/infrastructure/gateways/chat/system-instruction-context";
import {
  buildSkillRuntimeContext,
  collectSkillRuntimeWarnings,
  type SkillRuntimeContext,
} from "~/lib/server/infrastructure/gateways/skills/chat-skill-runtime";
import {
  buildSkillTools,
} from "~/lib/server/infrastructure/gateways/skills/chat-skill-tools";
import {
  emitSkillActivationOperationLogs,
} from "~/lib/server/infrastructure/gateways/skills/skill-operation-records";
import { prepareSkillRuntime } from "~/lib/server/usecase/chat/chat-skill-runtime-preparation";
import {
  buildChatExecutionLogContext,
  buildChatExecutionSuccessLogContext,
} from "~/lib/server/usecase/chat/chat-execution-log-context";
import { resolveExecutableCommand } from "~/lib/server/infrastructure/gateways/chat/stdio-runtime-path";
import { buildAgentRunContext } from "~/lib/server/usecase/chat/agent-run-context";
import {
  createAzureOpenAIClient,
} from "~/lib/server/infrastructure/gateways/azure/azure-openai-gateway";
import {
  type ChatExecutionOptions,
  buildUpstreamErrorPayload,
  isChatCanceledError,
  executeChat as executeChatUsecase,
  executeChatWithTransientRetry as executeChatWithTransientRetryUsecase,
} from "~/lib/server/usecase/chat/chat-execution";
import { buildAgentInstructionWithSkills } from "~/lib/server/usecase/chat/skill-instruction-builder";
import {
  applyDefaultThreadDirectoryToStdioServers,
  buildMcpServerSessionConfigKey,
} from "~/lib/server/usecase/chat/mcp-server-config-normalization";
type ChatMcpRuntimeMetrics = {
  mcpConnectedCount: number;
  mcpReusedCount: number;
  mcpEphemeralConnectCount: number;
  mcpConnectDurationMs: number;
  mcpSetupDurationMs: number;
};
type ChatExecutionResult = {
  message: string;
  threadEnvironment: ThreadEnvironment;
  operationLogCount: number;
  mcpRuntimeMetrics: ChatMcpRuntimeMetrics;
};
type ChatExecutionEvent =
  | {
      type: "progress";
      message: string;
      isMcp?: boolean;
    }
  | {
      type: "operation_log";
      record: ThreadOperationLogRecord;
    };
type ChatProgressEvent = RunStreamProgressEvent;
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

const CHAT_ALLOWED_METHODS = ["POST"] as const;

registerThreadMcpServerSessionPoolShutdownHooks();

const chatExecutionDependencies = {
  createAzureOpenAIClient,
  prepareMcpRuntime,
  acquireThreadMcpServerSession,
  buildThreadOperationLogRequestId,
  buildMcpConnectParams,
  buildMcpServerSessionConfigKey,
  getAzureMcpAuthorizationToken,
  createMcpServerSession,
  buildMcpConnectSuccessResponse,
  describeMcpServer,
  prepareSkillRuntime,
  buildSkillRuntimeContext,
  emitSkillActivationOperationLogs,
  collectSkillRuntimeWarnings,
  buildSystemInstructionContextPayload,
  buildSkillTools,
  buildAgentInstructionWithSkills,
  buildAgentRunContext,
  readProgressEventFromRunStreamEvent,
  cleanupChatRuntime,
  createCodeInterpreterContainerWithAttachments,
};

export function loader({}: Route.LoaderArgs) {
  installGlobalServerErrorLogging();
  return methodNotAllowedResponse(CHAT_ALLOWED_METHODS);
}

export async function action({ request }: Route.ActionArgs) {
  installGlobalServerErrorLogging();

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
    route: "/api/chat",
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
      route: "/api/chat",
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
    const upstreamError = buildUpstreamErrorPayload(
      error,
      azureConfig.deploymentName,
    );
    await logServerRouteEvent({
      request,
      route: "/api/chat",
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
        route: "/api/chat",
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
          route: "/api/chat",
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

      const upstreamError = buildUpstreamErrorPayload(
        error,
        options.azureConfig.deploymentName,
      );
      await logServerRouteEvent({
        route: "/api/chat",
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
