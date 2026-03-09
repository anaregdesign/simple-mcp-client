/**
 * API route module for /api/chat.
 */
import type { Route } from "./+types/api.chat";
import {
  Agent,
  MCPServerSSE,
  MCPServerStdio,
  MCPServerStreamableHttp,
  tool,
  type MCPServer,
} from "@openai/agents";
import { buildMcpServerConfigKey } from "~/lib/domain/mcp/config-key";
import {
  acquireThreadMcpServerSession,
  type ThreadMcpServerSession,
} from "~/lib/server/mcp/thread-mcp-server-session-pool";
import { registerThreadMcpServerSessionPoolShutdownHooks } from "~/lib/server/mcp/thread-mcp-server-session-pool-shutdown";
import {
  installGlobalServerErrorLogging,
  logServerRouteEvent,
} from "~/lib/server/observability/runtime-event-log";
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
  CHAT_MAX_CONSECUTIVE_IDENTICAL_SKILL_OPERATIONS,
  CHAT_MAX_IDENTICAL_SKILL_OPERATION_CALLS_PER_SIGNATURE,
  CHAT_MAX_IDENTICAL_SKILL_RUN_SCRIPT_CALLS_PER_SIGNATURE,
  CHAT_MAX_RUN_TURNS,
  CHAT_MAX_SKILL_OPERATION_CALLS_PER_SERVER_METHOD,
  CHAT_MAX_SKILL_OPERATION_ERRORS,
  CHAT_MAX_SKILL_RUN_SCRIPT_CALLS_PER_SERVER_METHOD,
  THREAD_ENVIRONMENT_KEY_MAX_LENGTH,
  THREAD_ENVIRONMENT_VALUE_MAX_LENGTH,
  THREAD_ENVIRONMENT_VARIABLES_MAX,
} from "~/lib/constants/chat";
import {
  ENV_KEY_PATTERN,
  MCP_DEFAULT_AZURE_AUTH_SCOPE,
  MCP_DEFAULT_HTTP_HEADERS,
  MCP_LOCAL_PLAYGROUND_CLIENT_PLATFORM_HEADER,
  MCP_LOCAL_PLAYGROUND_CLIENT_USER_AGENT_HEADER,
  MCP_LOCAL_PLAYGROUND_THREAD_ID_HEADER,
  MCP_LOCAL_PLAYGROUND_TURN_ID_HEADER,
  MCP_SERVER_NAME_MAX_LENGTH,
} from "~/lib/constants/mcp";
import {
  AGENT_SKILL_NAME_MAX_LENGTH,
  AGENT_SKILL_READ_TEXT_DEFAULT_MAX_CHARS,
  AGENT_SKILL_READ_TEXT_MAX_CHARS,
  AGENT_SKILL_SCRIPT_ARG_MAX_LENGTH,
  AGENT_SKILL_SCRIPT_MAX_ARGS,
  AGENT_SKILL_SCRIPT_OUTPUT_MAX_CHARS,
  AGENT_SKILL_SCRIPT_TIMEOUT_MAX_MS,
  AGENT_SKILL_TOOL_RESOURCE_PREVIEW_MAX_FILES,
} from "~/lib/constants/skills";
import {
  cloneThreadEnvironment,
  parseThreadEnvironmentFromUnknown,
  type ThreadEnvironment,
} from "~/lib/contracts/threads/environment";
import { type ThreadInstructionContextToggles } from "~/lib/contracts/threads/instruction-context";
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
  type ClientMcpServerConfig,
} from "~/lib/server/chat/request-parser";
import { logChatRequestValidationError } from "~/lib/server/infrastructure/gateways/chat/request-validation-log";
import { readSkillMarkdown } from "~/lib/server/skills/catalog";
import {
  readSkillResourceBuffer,
  readSkillResourceText,
  runSkillScript,
  type SkillResourceKind,
} from "~/lib/server/skills/runtime";
import { createJsonEventStreamResponse } from "~/lib/server/infrastructure/gateways/chat/json-event-stream";
import { cleanupChatRuntime } from "~/lib/server/infrastructure/gateways/chat/chat-runtime-cleanup";
import { prepareMcpRuntime } from "~/lib/server/infrastructure/gateways/mcp/chat-mcp-runtime";
import {
  readOptionalRequestHeaderValue,
  readWebSearchUserLocationFromRequest,
  wantsEventStream,
} from "~/lib/server/infrastructure/gateways/chat/request-metadata";
import {
  resolveThreadDirectoryContext,
  resolveThreadDirectoryPath,
} from "~/lib/server/chat/instruction-context-enrichment";
import { buildSystemInstructionContextPayload } from "~/lib/server/infrastructure/gateways/chat/system-instruction-context";
import {
  buildSkillRuntimeContext,
  collectSkillRuntimeWarnings,
  type ActiveSkillRuntimeEntry,
  type SkillRuntimeContext,
} from "~/lib/server/infrastructure/gateways/skills/chat-skill-runtime";
import { prepareSkillRuntime } from "~/lib/server/infrastructure/gateways/skills/chat-skill-runtime-preparation";
import {
  buildStdioSpawnEnvironment,
  resolveExecutableCommand,
} from "~/lib/server/chat/stdio-runtime-path";
import { buildAgentRunContext } from "~/lib/server/usecase/chat/agent-run-context";
import {
  createAzureOpenAIClient,
  getAzureBearerTokenForScope,
} from "~/lib/server/usecase/azure/azure-openai-service";
import {
  type ChatExecutionOptions,
  RequestCanceledError as ChatExecutionRequestCanceledError,
  type UpstreamErrorPayload,
  buildUpstreamErrorMessage as buildUpstreamErrorMessageUsecase,
  buildUpstreamErrorPayload as buildUpstreamErrorPayloadUsecase,
  createInitialChatMcpRuntimeMetrics as createInitialChatMcpRuntimeMetricsUsecase,
  executeChat as executeChatUsecase,
  executeChatWithTransientRetry as executeChatWithTransientRetryUsecase,
  hasNonPdfAttachments as hasNonPdfAttachmentsUsecase,
  isRequestCanceledError as isRequestCanceledErrorUsecase,
  isTransientNetworkTerminationError as isTransientNetworkTerminationErrorUsecase,
  runAgentWithTimeout as runAgentWithTimeoutUsecase,
  shouldRetryChatExecution as shouldRetryChatExecutionUsecase,
  sleep as sleepUsecase,
  throwIfAborted as throwIfAbortedUsecase,
} from "~/lib/server/usecase/chat/chat-execution";
import { buildAgentInstructionWithSkills } from "~/lib/server/usecase/chat/skill-instruction-builder";

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };
type ClientMcpHttpServerConfig = Extract<
  ClientMcpServerConfig,
  { transport: "streamable_http" | "sse" }
>;
type McpRequestContext = {
  threadId: string | null;
  turnId: string | null;
  clientUserAgent: string | null;
  clientPlatform: string | null;
};
type ChatMcpRuntimeMetrics = {
  mcpConnectedCount: number;
  mcpReusedCount: number;
  mcpEphemeralConnectCount: number;
  mcpConnectDurationMs: number;
  mcpSetupDurationMs: number;
};
type McpServerSessionRefreshState = {
  requestContext: McpRequestContext;
  getAzureAuthorizationToken: (scope: string) => Promise<string>;
  logHandlers: {
    nextSequence: () => number;
    onRecord: (record: ThreadOperationLogRecord) => void;
  };
};
type ChatExecutionResult = {
  message: string;
  threadEnvironment: ThreadEnvironment;
  operationLogCount: number;
  mcpRuntimeMetrics: ChatMcpRuntimeMetrics;
};
type JsonRpcRequestPayload = {
  jsonrpc: "2.0";
  id: string;
  method: string;
  params: Record<string, unknown>;
};
type JsonRpcResponsePayload =
  | {
      jsonrpc: "2.0";
      id: string;
      result: unknown;
    }
  | {
      jsonrpc: "2.0";
      id: string;
      error: {
        message: string;
      };
    };
type ThreadOperationLogRecord = {
  id: string;
  sequence: number;
  operationType: "mcp" | "skill";
  serverName: string;
  method: string;
  startedAt: string;
  completedAt: string;
  request: JsonRpcRequestPayload;
  response: JsonRpcResponsePayload;
  isError: boolean;
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
type ChatProgressEvent = {
  message: string;
  isMcp?: boolean;
};
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
type SkillToolCategory = SkillResourceKind;
type SkillToolLogHandlers = {
  nextSequence: () => number;
  onRecord: (record: ThreadOperationLogRecord) => void;
};

type SkillToolExecutionContext = {
  threadEnvironment: ThreadEnvironment;
};
type SkillOperationLoopState = {
  signature: string;
  consecutiveCount: number;
};
type SkillOperationCountState = {
  byServerMethod: Map<string, number>;
  errorCount: number;
};
type SkillOperationErrorLoopState = {
  signature: string;
  errorSignature: string;
  consecutiveCount: number;
};
type SkillOperationCachedResult = {
  rawResult: string;
  parsedResult: unknown;
  isError: boolean;
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
      if (signal.aborted || isRequestCanceledError(error)) {
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

function buildChatExecutionLogContext(
  options: ChatExecutionOptions,
): Record<string, unknown> {
  return {
    turnId: options.turnId,
    tenantId: options.azureConfig.tenantId,
    deploymentName: options.azureConfig.deploymentName,
    messageLength: options.message.length,
    historyCount: options.history.length,
    attachmentCount: options.attachments.length,
    threadEnvironmentKeyCount: Object.keys(options.threadEnvironment).length,
    reasoningEffort: options.reasoningEffort,
    webSearchEnabled: options.webSearchEnabled,
    webSearchUserLocationCountry:
      options.webSearchUserLocation?.country ?? null,
    systemInstructionContextEnabled: options.instructionContextToggles.system,
    mcpServerCount: options.mcpServers.length,
    skillCount: options.skills.length,
    explicitSkillLocationCount: options.explicitSkillLocations.length,
  };
}

function buildChatExecutionSuccessLogContext(
  options: ChatExecutionOptions,
  result: ChatExecutionResult,
): Record<string, unknown> {
  return {
    ...buildChatExecutionLogContext(options),
    responseLength: result.message.length,
    operationLogCount: result.operationLogCount,
    ...result.mcpRuntimeMetrics,
  };
}

function truncateProgressMessage(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) {
    return "unknown error";
  }

  const maxLength = 120;
  return trimmed.length <= maxLength
    ? trimmed
    : `${trimmed.slice(0, maxLength - 1)}...`;
}

function createInitialChatMcpRuntimeMetrics(): ChatMcpRuntimeMetrics {
  return createInitialChatMcpRuntimeMetricsUsecase();
}

function applyDefaultThreadDirectoryToStdioServers(
  mcpServers: ClientMcpServerConfig[],
  threadDirectoryPath: string | null,
  userDirectoryPath: string | null,
): ClientMcpServerConfig[] {
  if (!threadDirectoryPath) {
    return mcpServers;
  }

  const normalizedUserDirectoryPath =
    normalizePathForComparison(userDirectoryPath);
  const dedupeKeys = new Set<string>();
  const normalized: ClientMcpServerConfig[] = [];
  for (const server of mcpServers) {
    let nextServer: ClientMcpServerConfig = server;
    if (server.transport === "stdio") {
      const hasExplicitCwd =
        typeof server.cwd === "string" && server.cwd.trim().length > 0;
      const isLegacyWorkspaceRootCwd =
        hasExplicitCwd &&
        normalizePathForComparison(server.cwd) === normalizedUserDirectoryPath;
      if (!hasExplicitCwd || isLegacyWorkspaceRootCwd) {
        nextServer = {
          ...server,
          cwd: threadDirectoryPath,
        };
      }
    }
    const dedupeKey = buildMcpServerSessionConfigKey(nextServer);
    if (dedupeKeys.has(dedupeKey)) {
      continue;
    }

    dedupeKeys.add(dedupeKey);
    normalized.push(nextServer);
  }

  return normalized;
}

function buildMcpServerSessionConfigKey(config: ClientMcpServerConfig): string {
  return buildMcpServerConfigKey(config);
}

function buildMcpConnectSuccessResponse(
  requestId: string,
  status: "connected" | "reused",
): JsonRpcResponsePayload {
  return {
    jsonrpc: "2.0",
    id: requestId,
    result: {
      status,
    },
  };
}

async function createMcpServerSession(
  config: ClientMcpServerConfig,
): Promise<ThreadMcpServerSession<McpServerSessionRefreshState>> {
  if (config.transport === "stdio") {
    const env = buildStdioSpawnEnvironment(config.env);
    const command = resolveExecutableCommand(config.command, env);
    const server = new MCPServerStdio({
      name: config.name,
      command,
      args: config.args,
      cwd: config.cwd,
      env,
    });
    return {
      server,
      refreshBeforeUse: async (refreshState) => {
        instrumentMcpServer(server, refreshState.logHandlers);
      },
    };
  }

  const requestInit: RequestInit = {
    headers: {},
  };
  const server =
    config.transport === "sse"
      ? new MCPServerSSE({
          name: config.name,
          url: config.url,
          clientSessionTimeoutSeconds: config.timeoutSeconds,
          timeout: config.timeoutSeconds * 1000,
          fetch: fetchWithMcpMetaNormalization,
          requestInit,
        })
      : new MCPServerStreamableHttp({
          name: config.name,
          url: config.url,
          clientSessionTimeoutSeconds: config.timeoutSeconds,
          timeout: config.timeoutSeconds * 1000,
          fetch: fetchWithMcpMetaNormalization,
          requestInit,
        });
  return {
    server,
    refreshBeforeUse: async (refreshState) => {
      instrumentMcpServer(server, refreshState.logHandlers);
      const headers = await buildMcpHttpRuntimeHeaders(config, refreshState);
      requestInit.headers = headers;
    },
  };
}

async function buildMcpHttpRuntimeHeaders(
  config: ClientMcpHttpServerConfig,
  refreshState: McpServerSessionRefreshState,
): Promise<Record<string, string>> {
  const headers = buildMcpHttpRequestHeaders(config.headers);
  const contextHeaders = buildMcpContextRequestHeaders(
    config,
    refreshState.requestContext,
  );
  for (const [key, value] of Object.entries(contextHeaders)) {
    headers[key] = value;
  }
  if (config.useAzureAuth) {
    const token = await refreshState.getAzureAuthorizationToken(
      config.azureAuthScope,
    );
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function fetchWithMcpMetaNormalization(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(input, init);
  const contentType = (
    response.headers.get("content-type") ?? ""
  ).toLowerCase();
  if (!contentType.includes("application/json")) {
    return response;
  }

  let parsedBody: unknown;
  try {
    parsedBody = await response.clone().json();
  } catch {
    return response;
  }

  const normalizedMetaBody = normalizeMcpMetaNulls(parsedBody);
  const normalizedInitializeBody = normalizeMcpInitializeNullOptionals(
    normalizedMetaBody.value,
  );
  const normalizedToolsBody = normalizeMcpListToolsNullOptionals(
    normalizedInitializeBody.value,
  );
  if (
    !normalizedMetaBody.changed &&
    !normalizedInitializeBody.changed &&
    !normalizedToolsBody.changed
  ) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return new Response(JSON.stringify(normalizedToolsBody.value), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function normalizeMcpMetaNulls(value: unknown): {
  value: unknown;
  changed: boolean;
} {
  if (Array.isArray(value)) {
    let changed = false;
    const normalizedArray = value.map((entry) => {
      const normalized = normalizeMcpMetaNulls(entry);
      if (normalized.changed) {
        changed = true;
      }
      return normalized.value;
    });

    return changed
      ? { value: normalizedArray, changed: true }
      : { value, changed: false };
  }

  if (!isRecord(value)) {
    return { value, changed: false };
  }

  let changed = false;
  const normalizedObject: Record<string, unknown> = {};
  for (const [key, rawEntryValue] of Object.entries(value)) {
    if (key === "_meta" && rawEntryValue === null) {
      normalizedObject[key] = {};
      changed = true;
      continue;
    }

    const normalizedEntry = normalizeMcpMetaNulls(rawEntryValue);
    normalizedObject[key] = normalizedEntry.value;
    if (normalizedEntry.changed) {
      changed = true;
    }
  }

  return changed
    ? { value: normalizedObject, changed: true }
    : { value, changed: false };
}

function normalizeMcpInitializeNullOptionals(value: unknown): {
  value: unknown;
  changed: boolean;
} {
  if (Array.isArray(value)) {
    let changed = false;
    const normalizedArray = value.map((entry) => {
      const normalized = normalizeMcpInitializeNullOptionals(entry);
      if (normalized.changed) {
        changed = true;
      }
      return normalized.value;
    });

    return changed
      ? { value: normalizedArray, changed: true }
      : { value, changed: false };
  }

  if (!isRecord(value)) {
    return { value, changed: false };
  }

  const resultValue = value.result;
  if (!isRecord(resultValue) || !looksLikeInitializeResult(resultValue)) {
    return { value, changed: false };
  }

  const normalizedResult = stripNullFieldsRecursively(resultValue);
  if (!normalizedResult.changed) {
    return { value, changed: false };
  }

  return {
    value: {
      ...value,
      result: normalizedResult.value,
    },
    changed: true,
  };
}

function normalizeMcpListToolsNullOptionals(value: unknown): {
  value: unknown;
  changed: boolean;
} {
  if (Array.isArray(value)) {
    let changed = false;
    const normalizedArray = value.map((entry) => {
      const normalized = normalizeMcpListToolsNullOptionals(entry);
      if (normalized.changed) {
        changed = true;
      }
      return normalized.value;
    });

    return changed
      ? { value: normalizedArray, changed: true }
      : { value, changed: false };
  }

  if (!isRecord(value)) {
    return { value, changed: false };
  }

  const resultValue = value.result;
  if (!isRecord(resultValue) || !Array.isArray(resultValue.tools)) {
    return { value, changed: false };
  }

  let changed = false;
  const normalizedTools = resultValue.tools.map((tool) => {
    if (!isRecord(tool)) {
      return tool;
    }

    const normalizedTool = stripNullFieldsRecursively(tool);
    if (normalizedTool.changed) {
      changed = true;
    }
    return normalizedTool.value;
  });

  if (!changed) {
    return { value, changed: false };
  }

  return {
    value: {
      ...value,
      result: {
        ...resultValue,
        tools: normalizedTools,
      },
    },
    changed: true,
  };
}

function looksLikeInitializeResult(value: Record<string, unknown>): boolean {
  const hasProtocolVersion = typeof value.protocolVersion === "string";
  const hasCapabilities = "capabilities" in value;
  const hasServerInfo = "serverInfo" in value;
  return hasProtocolVersion || (hasCapabilities && hasServerInfo);
}

function stripNullFieldsRecursively(value: unknown): {
  value: unknown;
  changed: boolean;
} {
  if (Array.isArray(value)) {
    let changed = false;
    const normalizedArray: unknown[] = [];
    for (const entry of value) {
      if (entry === null) {
        changed = true;
        continue;
      }

      const normalizedEntry = stripNullFieldsRecursively(entry);
      if (normalizedEntry.changed) {
        changed = true;
      }
      normalizedArray.push(normalizedEntry.value);
    }

    return changed
      ? { value: normalizedArray, changed: true }
      : { value, changed: false };
  }

  if (!isRecord(value)) {
    return { value, changed: false };
  }

  let changed = false;
  const normalizedObject: Record<string, unknown> = {};
  for (const [key, entryValue] of Object.entries(value)) {
    if (entryValue === null) {
      changed = true;
      continue;
    }

    const normalizedEntry = stripNullFieldsRecursively(entryValue);
    if (normalizedEntry.changed) {
      changed = true;
    }
    normalizedObject[key] = normalizedEntry.value;
  }

  return changed
    ? { value: normalizedObject, changed: true }
    : { value, changed: false };
}

type InstrumentMcpServerHandlers = {
  nextSequence: () => number;
  onRecord: (record: ThreadOperationLogRecord) => void;
};

type InstrumentedMcpServerState = {
  handlers: InstrumentMcpServerHandlers;
  resetListToolsCache: () => void;
};

const instrumentedMcpServerStateSymbol = Symbol(
  "local-playground.instrumented-mcp-server-state",
);

function instrumentMcpServer(
  server: MCPServer,
  handlers: InstrumentMcpServerHandlers,
): MCPServer {
  const instrumentedServer = server as MCPServer & {
    [instrumentedMcpServerStateSymbol]?: InstrumentedMcpServerState;
  };
  const existingState = instrumentedServer[instrumentedMcpServerStateSymbol];
  if (existingState) {
    existingState.handlers = handlers;
    return server;
  }

  const originalListTools = server.listTools.bind(server);
  const originalCallTool = server.callTool.bind(server);
  const originalInvalidateToolsCache = server.invalidateToolsCache.bind(server);
  let hasCachedListToolsResult = false;
  let cachedListToolsResult: Awaited<
    ReturnType<typeof originalListTools>
  > | null = null;
  let pendingListToolsResult: Promise<
    Awaited<ReturnType<typeof originalListTools>>
  > | null = null;
  const state: InstrumentedMcpServerState = {
    handlers,
    resetListToolsCache: () => {
      hasCachedListToolsResult = false;
      cachedListToolsResult = null;
      pendingListToolsResult = null;
    },
  };
  instrumentedServer[instrumentedMcpServerStateSymbol] = state;

  server.listTools = async () => {
    if (hasCachedListToolsResult && cachedListToolsResult !== null) {
      return cachedListToolsResult;
    }
    if (pendingListToolsResult) {
      return pendingListToolsResult;
    }

    const sequence = state.handlers.nextSequence();
    const requestId = buildThreadOperationLogRequestId(server.name, sequence);
    const startedAt = new Date().toISOString();
    const requestPayload: JsonRpcRequestPayload = {
      jsonrpc: "2.0",
      id: requestId,
      method: "tools/list",
      params: {},
    };

    const requestPromise = (async () => {
      try {
        const result = await originalListTools();
        const responsePayload: JsonRpcResponsePayload = {
          jsonrpc: "2.0",
          id: requestId,
          result: {
            tools: toSerializableValue(result),
          },
        };

        state.handlers.onRecord({
          id: requestId,
          sequence,
          operationType: "mcp",
          serverName: server.name,
          method: "tools/list",
          startedAt,
          completedAt: new Date().toISOString(),
          request: requestPayload,
          response: responsePayload,
          isError: false,
        });

        cachedListToolsResult = result;
        hasCachedListToolsResult = true;
        return result;
      } catch (error) {
        const responsePayload: JsonRpcResponsePayload = {
          jsonrpc: "2.0",
          id: requestId,
          error: {
            message: readErrorMessage(error),
          },
        };

        state.handlers.onRecord({
          id: requestId,
          sequence,
          operationType: "mcp",
          serverName: server.name,
          method: "tools/list",
          startedAt,
          completedAt: new Date().toISOString(),
          request: requestPayload,
          response: responsePayload,
          isError: true,
        });

        throw error;
      } finally {
        pendingListToolsResult = null;
      }
    })();

    pendingListToolsResult = requestPromise;
    return requestPromise;
  };

  server.invalidateToolsCache = () => {
    state.resetListToolsCache();
    return originalInvalidateToolsCache();
  };

  server.callTool = async (toolName, args, meta) => {
    const sequence = state.handlers.nextSequence();
    const requestId = buildThreadOperationLogRequestId(server.name, sequence);
    const startedAt = new Date().toISOString();
    const requestPayload: JsonRpcRequestPayload = {
      jsonrpc: "2.0",
      id: requestId,
      method: "tools/call",
      params: {
        name: toolName,
        arguments: toSerializableValue(args ?? {}),
        ...(meta ? { _meta: toSerializableValue(meta) } : {}),
      },
    };

    try {
      const result = await originalCallTool(toolName, args, meta);
      const responsePayload: JsonRpcResponsePayload = {
        jsonrpc: "2.0",
        id: requestId,
        result: toSerializableValue(result),
      };

      state.handlers.onRecord({
        id: requestId,
        sequence,
        operationType: "mcp",
        serverName: server.name,
        method: "tools/call",
        startedAt,
        completedAt: new Date().toISOString(),
        request: requestPayload,
        response: responsePayload,
        isError: false,
      });

      return result;
    } catch (error) {
      const responsePayload: JsonRpcResponsePayload = {
        jsonrpc: "2.0",
        id: requestId,
        error: {
          message: readErrorMessage(error),
        },
      };

      state.handlers.onRecord({
        id: requestId,
        sequence,
        operationType: "mcp",
        serverName: server.name,
        method: "tools/call",
        startedAt,
        completedAt: new Date().toISOString(),
        request: requestPayload,
        response: responsePayload,
        isError: true,
      });

      throw error;
    }
  };

  return server;
}

function buildThreadOperationLogRequestId(
  serverName: string,
  sequence: number,
): string {
  const normalizedName =
    serverName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-") || "mcp";
  return `${normalizedName}-${Date.now()}-${sequence}`;
}

function buildMcpConnectParams(
  serverConfig: ClientMcpServerConfig,
): Record<string, unknown> {
  if (serverConfig.transport === "stdio") {
    return {
      transport: "stdio",
      command: serverConfig.command,
      args: serverConfig.args,
      cwd: serverConfig.cwd ?? "",
      envKeys: Object.keys(serverConfig.env).sort((left, right) =>
        left.localeCompare(right),
      ),
      env: toSerializableValue(serverConfig.env),
    };
  }

  return {
    transport: serverConfig.transport,
    url: serverConfig.url,
    headerKeys: Object.keys(serverConfig.headers).sort((left, right) =>
      left.localeCompare(right),
    ),
    useAzureAuth: serverConfig.useAzureAuth,
    azureAuthScope: serverConfig.azureAuthScope,
    timeoutSeconds: serverConfig.timeoutSeconds,
  };
}

function toSerializableValue(value: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

function buildSkillOperationLoopSignature(
  serverName: string,
  method: string,
  input: unknown,
): string {
  return JSON.stringify({
    serverName,
    method,
    input: normalizeObjectKeyOrder(toSerializableValue(input)),
  });
}

function normalizeObjectKeyOrder(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeObjectKeyOrder(item));
  }
  if (!isRecord(value)) {
    return value;
  }

  const normalized: Record<string, unknown> = {};
  const sortedEntries = Object.entries(value).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  for (const [key, entryValue] of sortedEntries) {
    normalized[key] = normalizeObjectKeyOrder(entryValue);
  }

  return normalized;
}

function updateSkillOperationLoopState(
  current: SkillOperationLoopState,
  nextSignature: string,
): SkillOperationLoopState {
  if (current.signature === nextSignature) {
    return {
      signature: nextSignature,
      consecutiveCount: current.consecutiveCount + 1,
    };
  }

  return {
    signature: nextSignature,
    consecutiveCount: 1,
  };
}

function updateSkillOperationErrorLoopState(
  current: SkillOperationErrorLoopState,
  nextSignature: string,
  nextErrorSignature: string,
): SkillOperationErrorLoopState {
  if (
    current.signature === nextSignature &&
    current.errorSignature === nextErrorSignature
  ) {
    return {
      signature: nextSignature,
      errorSignature: nextErrorSignature,
      consecutiveCount: current.consecutiveCount + 1,
    };
  }

  return {
    signature: nextSignature,
    errorSignature: nextErrorSignature,
    consecutiveCount: 1,
  };
}

function buildSkillOperationErrorSignature(value: unknown): string {
  const maxLength = 512;
  const normalize = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) {
      return "unknown";
    }

    return trimmed.length > maxLength
      ? `${trimmed.slice(0, maxLength)}...`
      : trimmed;
  };

  if (typeof value === "string") {
    return normalize(value);
  }

  if (value instanceof Error) {
    return normalize(value.message);
  }

  if (isRecord(value)) {
    const narrowed: Record<string, unknown> = {};
    const errorMessage = readTrimmedString(value.error);
    if (errorMessage) {
      narrowed.error = errorMessage;
    }
    if (Object.hasOwn(value, "exitCode")) {
      narrowed.exitCode = toSerializableValue(value.exitCode);
    }
    const stderr = readTrimmedString(value.stderr);
    if (stderr) {
      narrowed.stderr = stderr;
    }
    const signal = readTrimmedString(value.signal);
    if (signal) {
      narrowed.signal = signal;
    }
    if (typeof value.timedOut === "boolean") {
      narrowed.timedOut = value.timedOut;
    }

    if (Object.keys(narrowed).length > 0) {
      const serializedNarrowed = JSON.stringify(
        normalizeObjectKeyOrder(narrowed),
      );
      return normalize(serializedNarrowed ?? "unknown");
    }
  }

  const serialized = JSON.stringify(
    normalizeObjectKeyOrder(toSerializableValue(value)),
  );
  return normalize(serialized ?? "unknown");
}

function buildRepeatedSkillOperationLoopMessage(options: {
  serverName: string;
  method: string;
  consecutiveCount: number;
}): string {
  return `Detected a repeated Skill operation loop for ${options.serverName}.${options.method} (${options.consecutiveCount} identical consecutive calls). Stopped early to avoid exceeding max turns.`;
}

function buildSkillOperationCountKey(
  serverName: string,
  method: string,
): string {
  return `${serverName}::${method}`;
}

function incrementSkillOperationCount(
  countsByServerMethod: Map<string, number>,
  serverName: string,
  method: string,
): number {
  const key = buildSkillOperationCountKey(serverName, method);
  const nextCount = (countsByServerMethod.get(key) ?? 0) + 1;
  countsByServerMethod.set(key, nextCount);
  return nextCount;
}

function readSkillOperationCallLimit(method: string): number {
  return method === "skill_run_script"
    ? CHAT_MAX_SKILL_RUN_SCRIPT_CALLS_PER_SERVER_METHOD
    : CHAT_MAX_SKILL_OPERATION_CALLS_PER_SERVER_METHOD;
}

function readSkillOperationSignatureCallLimit(method: string): number {
  return method === "skill_run_script"
    ? CHAT_MAX_IDENTICAL_SKILL_RUN_SCRIPT_CALLS_PER_SIGNATURE
    : CHAT_MAX_IDENTICAL_SKILL_OPERATION_CALLS_PER_SIGNATURE;
}

function buildSkillOperationCountExceededMessage(options: {
  serverName: string;
  method: string;
  count: number;
}): string {
  return `Detected excessive Skill operation usage for ${options.serverName}.${options.method} (${options.count} calls in one run). Stopped early to avoid exceeding max turns.`;
}

function buildSkillOperationErrorCountExceededMessage(options: {
  errorCount: number;
}): string {
  return `Detected too many Skill operation errors in one run (${options.errorCount}). Stopped early to avoid repeated failures.`;
}

function buildSkillOperationSignatureCountExceededMessage(options: {
  serverName: string;
  method: string;
  count: number;
}): string {
  return `Detected repeated identical Skill operation errors for ${options.serverName}.${options.method} (${options.count} consecutive identical errors without recurrence-prevention change). Stopped early to avoid redundant retries.`;
}

function shouldCacheSkillOperationResult(method: string): boolean {
  if (
    method === "skill_list_resources" ||
    method === "skill_read_guide" ||
    method === "skill_read_reference" ||
    method === "skill_read_asset"
  ) {
    return true;
  }

  return false;
}

function buildMcpHttpRequestHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  const mergedHeaders: Record<string, string> = { ...MCP_DEFAULT_HTTP_HEADERS };
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === "content-type") {
      continue;
    }
    mergedHeaders[key] = value;
  }

  return mergedHeaders;
}

function buildMcpContextRequestHeaders(
  serverConfig: ClientMcpServerConfig,
  requestContext: McpRequestContext,
): Record<string, string> {
  if (
    serverConfig.transport === "stdio" ||
    !isLocalPlaygroundMcpContextUrl(serverConfig.url)
  ) {
    return {};
  }

  const contextHeaders: Record<string, string> = {};
  if (requestContext.threadId) {
    contextHeaders[MCP_LOCAL_PLAYGROUND_THREAD_ID_HEADER] =
      requestContext.threadId;
  }
  if (requestContext.turnId) {
    contextHeaders[MCP_LOCAL_PLAYGROUND_TURN_ID_HEADER] = requestContext.turnId;
  }
  if (requestContext.clientUserAgent) {
    contextHeaders[MCP_LOCAL_PLAYGROUND_CLIENT_USER_AGENT_HEADER] =
      requestContext.clientUserAgent;
  }
  if (requestContext.clientPlatform) {
    contextHeaders[MCP_LOCAL_PLAYGROUND_CLIENT_PLATFORM_HEADER] =
      requestContext.clientPlatform;
  }
  return contextHeaders;
}

function isLocalPlaygroundMcpContextUrl(rawUrl: string): boolean {
  const trimmedUrl = rawUrl.trim();
  if (!trimmedUrl) {
    return false;
  }

  if (trimmedUrl.startsWith("/") && !trimmedUrl.startsWith("//")) {
    let parsedRelativeUrl: URL;
    try {
      parsedRelativeUrl = new URL(trimmedUrl, "http://localhost");
    } catch {
      return false;
    }

    const normalizedRelativePath = parsedRelativeUrl.pathname.replace(
      /\/+$/,
      "",
    );
    return normalizedRelativePath === "/mcp/cmd";
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmedUrl);
  } catch {
    return false;
  }

  const normalizedPathname = parsedUrl.pathname.replace(/\/+$/, "");
  if (normalizedPathname !== "/mcp/cmd") {
    return false;
  }

  const hostname = parsedUrl.hostname.trim().toLowerCase();
  return (
    hostname === "localhost" ||
    hostname === "::1" ||
    hostname === "0.0.0.0" ||
    hostname === "127.0.0.1" ||
    hostname.startsWith("127.")
  );
}

async function getAzureMcpAuthorizationToken(
  scope: string,
  tenantId: string,
): Promise<string> {
  try {
    return await getAzureBearerTokenForScope(scope, tenantId);
  } catch {
    throw new Error(
      `Azure credential failed to acquire token for MCP Authorization header (scope: ${scope}). Run Azure Login and try again.`,
    );
  }
}

function describeMcpServer(config: ClientMcpServerConfig): string {
  if (config.transport === "stdio") {
    const argsPart = config.args.length > 0 ? ` ${config.args.join(" ")}` : "";
    return `stdio:${config.command}${argsPart}`;
  }

  return config.useAzureAuth
    ? `${config.url} (azure auth: ${config.azureAuthScope}, timeout: ${config.timeoutSeconds}s)`
    : `${config.url} (timeout: ${config.timeoutSeconds}s)`;
}

function buildSkillTools(
  activeSkills: ActiveSkillRuntimeEntry[],
  logHandlers: SkillToolLogHandlers,
  executionContext: SkillToolExecutionContext,
) {
  if (activeSkills.length === 0) {
    return [];
  }

  const activeSkillsByName = new Map<string, ActiveSkillRuntimeEntry[]>();
  for (const skill of activeSkills) {
    const list = activeSkillsByName.get(skill.name) ?? [];
    list.push(skill);
    activeSkillsByName.set(skill.name, list);
  }

  const resolveSkillSelection = (
    selectorValue: unknown,
    options: {
      allowAllWhenMissing: boolean;
    },
  ):
    | { ok: true; skills: ActiveSkillRuntimeEntry[] }
    | { ok: false; error: string } => {
    const selector = readTrimmedString(selectorValue);
    if (!selector) {
      if (options.allowAllWhenMissing) {
        return { ok: true, skills: activeSkills };
      }

      if (activeSkills.length === 1) {
        return { ok: true, skills: [activeSkills[0]] };
      }

      return {
        ok: false,
        error:
          "Multiple Skills are active. Provide `skill` by name or location.",
      };
    }

    const byLocation = activeSkills.find(
      (skill) => skill.location === selector,
    );
    if (byLocation) {
      return { ok: true, skills: [byLocation] };
    }

    const byName = activeSkillsByName.get(selector) ?? [];
    if (byName.length === 1) {
      return { ok: true, skills: byName };
    }

    if (byName.length > 1) {
      return {
        ok: false,
        error: "Skill name is ambiguous. Provide the full `skill` location.",
      };
    }

    return {
      ok: false,
      error: `Active Skill not found: ${selector}`,
    };
  };

  const readSkillOperationServerName = (input: unknown): string => {
    if (isRecord(input)) {
      const selector = readTrimmedString(input.skill);
      if (selector) {
        return selector;
      }
    }

    if (activeSkills.length === 1) {
      return activeSkills[0]?.name ?? "skill-runtime";
    }

    return "skill-runtime";
  };

  const readCurrentThreadEnvironment = (): ThreadEnvironment =>
    cloneThreadEnvironment(executionContext.threadEnvironment);

  const readSkillOperationParams = (
    input: unknown,
  ): Record<string, unknown> => {
    const threadEnvironment = cloneThreadEnvironment(
      executionContext.threadEnvironment,
    );
    if (!isRecord(input)) {
      return {
        input: toSerializableValue(input),
        threadEnvironment,
      };
    }

    const serialized = toSerializableValue(input);
    const baseParams = isRecord(serialized) ? serialized : {};
    return {
      ...baseParams,
      threadEnvironment,
    };
  };

  const parseSkillOperationResult = (result: string): unknown => {
    const trimmed = result.trim();
    if (!trimmed) {
      return "";
    }

    try {
      return JSON.parse(trimmed);
    } catch {
      return result;
    }
  };
  let skillOperationLoopState: SkillOperationLoopState = {
    signature: "",
    consecutiveCount: 0,
  };
  let skillOperationErrorLoopState: SkillOperationErrorLoopState = {
    signature: "",
    errorSignature: "",
    consecutiveCount: 0,
  };
  const skillOperationCountState: SkillOperationCountState = {
    byServerMethod: new Map<string, number>(),
    errorCount: 0,
  };
  const skillOperationCachedResultBySignature = new Map<
    string,
    SkillOperationCachedResult
  >();

  const resetSkillOperationErrorLoopState = () => {
    skillOperationErrorLoopState = {
      signature: "",
      errorSignature: "",
      consecutiveCount: 0,
    };
  };

  const applySkillOperationErrorGuards = (options: {
    method: string;
    serverName: string;
    operationSignature: string;
    errorPayload: unknown;
  }): void => {
    const errorSignature = buildSkillOperationErrorSignature(
      options.errorPayload,
    );
    skillOperationErrorLoopState = updateSkillOperationErrorLoopState(
      skillOperationErrorLoopState,
      options.operationSignature,
      errorSignature,
    );
    const operationSignatureCallLimit = readSkillOperationSignatureCallLimit(
      options.method,
    );
    if (
      skillOperationErrorLoopState.consecutiveCount >
      operationSignatureCallLimit
    ) {
      throw new Error(
        buildSkillOperationSignatureCountExceededMessage({
          serverName: options.serverName,
          method: options.method,
          count: skillOperationErrorLoopState.consecutiveCount,
        }),
      );
    }

    skillOperationCountState.errorCount += 1;
    if (skillOperationCountState.errorCount > CHAT_MAX_SKILL_OPERATION_ERRORS) {
      throw new Error(
        buildSkillOperationErrorCountExceededMessage({
          errorCount: skillOperationCountState.errorCount,
        }),
      );
    }
  };

  const executeWithSkillOperationLog = async (
    method: string,
    input: unknown,
    execute: () => Promise<string> | string,
  ): Promise<string> => {
    const operationParams = readSkillOperationParams(input);
    const sequence = logHandlers.nextSequence();
    const serverName = readSkillOperationServerName(input);
    const requestId = buildThreadOperationLogRequestId(serverName, sequence);
    const startedAt = new Date().toISOString();
    const requestPayload: JsonRpcRequestPayload = {
      jsonrpc: "2.0",
      id: requestId,
      method,
      params: operationParams,
    };
    const operationCountForServerMethod = incrementSkillOperationCount(
      skillOperationCountState.byServerMethod,
      serverName,
      method,
    );
    const operationCallLimit = readSkillOperationCallLimit(method);
    if (operationCountForServerMethod > operationCallLimit) {
      const operationCountErrorMessage =
        buildSkillOperationCountExceededMessage({
          serverName,
          method,
          count: operationCountForServerMethod,
        });
      const responsePayload: JsonRpcResponsePayload = {
        jsonrpc: "2.0",
        id: requestId,
        error: {
          message: operationCountErrorMessage,
        },
      };
      logHandlers.onRecord({
        id: requestId,
        sequence,
        operationType: "skill",
        serverName,
        method,
        startedAt,
        completedAt: new Date().toISOString(),
        request: requestPayload,
        response: responsePayload,
        isError: true,
      });
      throw new Error(operationCountErrorMessage);
    }
    const operationSignature = buildSkillOperationLoopSignature(
      serverName,
      method,
      method === "skill_run_script" ? operationParams : input,
    );
    skillOperationLoopState = updateSkillOperationLoopState(
      skillOperationLoopState,
      operationSignature,
    );
    if (
      skillOperationLoopState.consecutiveCount >
      CHAT_MAX_CONSECUTIVE_IDENTICAL_SKILL_OPERATIONS
    ) {
      const loopErrorMessage = buildRepeatedSkillOperationLoopMessage({
        serverName,
        method,
        consecutiveCount: skillOperationLoopState.consecutiveCount,
      });
      const responsePayload: JsonRpcResponsePayload = {
        jsonrpc: "2.0",
        id: requestId,
        error: {
          message: loopErrorMessage,
        },
      };
      logHandlers.onRecord({
        id: requestId,
        sequence,
        operationType: "skill",
        serverName,
        method,
        startedAt,
        completedAt: new Date().toISOString(),
        request: requestPayload,
        response: responsePayload,
        isError: true,
      });
      throw new Error(loopErrorMessage);
    }

    const cachedResult =
      skillOperationCachedResultBySignature.get(operationSignature);
    if (cachedResult) {
      const responsePayload: JsonRpcResponsePayload = {
        jsonrpc: "2.0",
        id: requestId,
        result: cachedResult.parsedResult,
      };
      logHandlers.onRecord({
        id: requestId,
        sequence,
        operationType: "skill",
        serverName,
        method,
        startedAt,
        completedAt: new Date().toISOString(),
        request: requestPayload,
        response: responsePayload,
        isError: cachedResult.isError,
      });
      if (cachedResult.isError) {
        applySkillOperationErrorGuards({
          method,
          serverName,
          operationSignature,
          errorPayload: cachedResult.parsedResult,
        });
      } else {
        resetSkillOperationErrorLoopState();
      }

      return cachedResult.rawResult;
    }

    let result: string;
    try {
      result = await execute();
    } catch (error) {
      const errorMessage = readErrorMessage(error);
      const responsePayload: JsonRpcResponsePayload = {
        jsonrpc: "2.0",
        id: requestId,
        error: {
          message: errorMessage,
        },
      };

      logHandlers.onRecord({
        id: requestId,
        sequence,
        operationType: "skill",
        serverName,
        method,
        startedAt,
        completedAt: new Date().toISOString(),
        request: requestPayload,
        response: responsePayload,
        isError: true,
      });

      applySkillOperationErrorGuards({
        method,
        serverName,
        operationSignature,
        errorPayload: errorMessage,
      });
      throw error;
    }

    const parsedResult = parseSkillOperationResult(result);
    const skillOperationErrored = isSkillOperationErrorResult(parsedResult);
    if (shouldCacheSkillOperationResult(method)) {
      skillOperationCachedResultBySignature.set(operationSignature, {
        rawResult: result,
        parsedResult,
        isError: skillOperationErrored,
      });
    }
    const responsePayload: JsonRpcResponsePayload = {
      jsonrpc: "2.0",
      id: requestId,
      result: parsedResult,
    };

    logHandlers.onRecord({
      id: requestId,
      sequence,
      operationType: "skill",
      serverName,
      method,
      startedAt,
      completedAt: new Date().toISOString(),
      request: requestPayload,
      response: responsePayload,
      isError: skillOperationErrored,
    });
    if (skillOperationErrored) {
      applySkillOperationErrorGuards({
        method,
        serverName,
        operationSignature,
        errorPayload: parsedResult,
      });
    } else {
      resetSkillOperationErrorLoopState();
    }

    return result;
  };

  const listResourcesTool = tool({
    name: "skill_list_resources",
    description:
      "List scripts, references, and assets available in active Skills. Use this before reading files or running scripts.",
    parameters: {
      type: "object" as const,
      properties: {
        skill: {
          type: "string" as const,
          description:
            "Optional active Skill name or location. If omitted, resources from all active Skills are listed.",
        },
        category: {
          type: "string" as const,
          enum: ["scripts", "references", "assets"],
          description: "Optional resource category filter.",
        },
      },
      required: [],
      additionalProperties: true as const,
    },
    strict: false,
    execute: (input) =>
      executeWithSkillOperationLog("skill_list_resources", input, () => {
        if (!isRecord(input)) {
          return buildSkillToolErrorResult("Invalid tool input.");
        }

        const selectedCategory = readSkillToolCategory(input.category);
        if (input.category !== undefined && !selectedCategory) {
          return buildSkillToolErrorResult(
            "category must be one of scripts, references, or assets.",
          );
        }

        const skillSelection = resolveSkillSelection(input.skill, {
          allowAllWhenMissing: true,
        });
        if (!skillSelection.ok) {
          return buildSkillToolErrorResult(skillSelection.error);
        }

        return buildSkillToolResult({
          ok: true,
          skills: skillSelection.skills.map((skill) =>
            buildSkillResourcePreview(skill, selectedCategory),
          ),
        });
      }),
  });

  const readGuideTool = tool({
    name: "skill_read_guide",
    description:
      "Read the full SKILL.md instructions for an active Skill. Use this only when frontmatter is insufficient for the current task.",
    parameters: {
      type: "object" as const,
      properties: {
        skill: {
          type: "string" as const,
          description:
            "Optional active Skill name or location. Required when multiple Skills are active.",
        },
        startLine: {
          type: "integer" as const,
          minimum: 1,
          description: "Optional 1-based start line.",
        },
        endLine: {
          type: "integer" as const,
          minimum: 1,
          description: "Optional 1-based end line.",
        },
        maxChars: {
          type: "integer" as const,
          minimum: 1,
          description: "Optional max character length for returned text.",
        },
      },
      required: [],
      additionalProperties: true as const,
    },
    strict: false,
    execute: (input) =>
      executeWithSkillOperationLog("skill_read_guide", input, async () => {
        if (!isRecord(input)) {
          return buildSkillToolErrorResult("Invalid tool input.");
        }

        const skillSelection = resolveSkillSelection(input.skill, {
          allowAllWhenMissing: false,
        });
        if (!skillSelection.ok) {
          return buildSkillToolErrorResult(skillSelection.error);
        }
        const selectedSkill = skillSelection.skills[0];

        let content: string;
        try {
          content = await readSkillMarkdown(selectedSkill.location);
        } catch (error) {
          return buildSkillToolErrorResult(readErrorMessage(error));
        }

        const startLine = readInteger(input.startLine);
        const endLine = readInteger(input.endLine);
        if (
          (startLine !== null && startLine <= 0) ||
          (endLine !== null && endLine <= 0)
        ) {
          return buildSkillToolErrorResult(
            "startLine and endLine must be positive integers.",
          );
        }
        if (startLine !== null && endLine !== null && endLine < startLine) {
          return buildSkillToolErrorResult(
            "endLine must be greater than or equal to startLine.",
          );
        }

        const maxChars = normalizeSkillReadMaxChars(input.maxChars);
        const lineNormalized = content.replace(/\r\n?/g, "\n");
        const lines = lineNormalized.split("\n");
        const begin = Math.max(1, startLine ?? 1);
        const end = Math.min(lines.length, endLine ?? lines.length);
        const lineWindowText =
          lines.length === 0 || end < begin
            ? ""
            : lines.slice(begin - 1, end).join("\n");
        const clipped = clipTextForSkillTool(lineWindowText, maxChars);

        return buildSkillToolResult({
          ok: true,
          skill: selectedSkill.name,
          location: selectedSkill.location,
          path: "SKILL.md",
          startLine: begin,
          endLine: end,
          totalLines: lines.length,
          truncated: clipped.truncated,
          text: clipped.value,
        });
      }),
  });

  const readReferenceTool = tool({
    name: "skill_read_reference",
    description:
      "Read text files from Skill references directories. Use this to load policies, docs, and checklists.",
    parameters: {
      type: "object" as const,
      properties: {
        skill: {
          type: "string" as const,
          description:
            "Optional active Skill name or location. Required when multiple Skills are active.",
        },
        path: {
          type: "string" as const,
          description:
            "Relative file path inside the selected Skill's references directory.",
        },
        startLine: {
          type: "integer" as const,
          minimum: 1,
          description: "Optional 1-based start line.",
        },
        endLine: {
          type: "integer" as const,
          minimum: 1,
          description: "Optional 1-based end line.",
        },
        maxChars: {
          type: "integer" as const,
          minimum: 1,
          description: "Optional max character length for returned text.",
        },
      },
      required: ["path"],
      additionalProperties: true as const,
    },
    strict: false,
    execute: (input) =>
      executeWithSkillOperationLog("skill_read_reference", input, async () => {
        if (!isRecord(input)) {
          return buildSkillToolErrorResult("Invalid tool input.");
        }

        const skillSelection = resolveSkillSelection(input.skill, {
          allowAllWhenMissing: false,
        });
        if (!skillSelection.ok) {
          return buildSkillToolErrorResult(skillSelection.error);
        }
        const selectedSkill = skillSelection.skills[0];

        const relativePath = readTrimmedString(input.path);
        if (!relativePath) {
          return buildSkillToolErrorResult("path is required.");
        }

        let content: string;
        try {
          content = await readSkillResourceText({
            skillRoot: selectedSkill.skillRoot,
            kind: "references",
            relativePath,
          });
        } catch (error) {
          return buildSkillToolErrorResult(readErrorMessage(error));
        }

        const startLine = readInteger(input.startLine);
        const endLine = readInteger(input.endLine);
        if (
          (startLine !== null && startLine <= 0) ||
          (endLine !== null && endLine <= 0)
        ) {
          return buildSkillToolErrorResult(
            "startLine and endLine must be positive integers.",
          );
        }
        if (startLine !== null && endLine !== null && endLine < startLine) {
          return buildSkillToolErrorResult(
            "endLine must be greater than or equal to startLine.",
          );
        }

        const maxChars = normalizeSkillReadMaxChars(input.maxChars);
        const lineNormalized = content.replace(/\r\n?/g, "\n");
        const lines = lineNormalized.split("\n");
        const begin = Math.max(1, startLine ?? 1);
        const end = Math.min(lines.length, endLine ?? lines.length);
        const lineWindowText =
          lines.length === 0 || end < begin
            ? ""
            : lines.slice(begin - 1, end).join("\n");
        const clipped = clipTextForSkillTool(lineWindowText, maxChars);

        return buildSkillToolResult({
          ok: true,
          skill: selectedSkill.name,
          location: selectedSkill.location,
          path: relativePath,
          startLine: begin,
          endLine: end,
          totalLines: lines.length,
          truncated: clipped.truncated,
          text: clipped.value,
        });
      }),
  });

  const readAssetTool = tool({
    name: "skill_read_asset",
    description:
      "Read files from Skill assets directories. Use encoding=text for UTF-8 assets or encoding=base64 for binary payloads.",
    parameters: {
      type: "object" as const,
      properties: {
        skill: {
          type: "string" as const,
          description:
            "Optional active Skill name or location. Required when multiple Skills are active.",
        },
        path: {
          type: "string" as const,
          description:
            "Relative file path inside the selected Skill's assets directory.",
        },
        encoding: {
          type: "string" as const,
          enum: ["text", "base64"],
          description: "Return encoding for asset content.",
        },
        maxChars: {
          type: "integer" as const,
          minimum: 1,
          description: "Optional max character length for returned content.",
        },
      },
      required: ["path"],
      additionalProperties: true as const,
    },
    strict: false,
    execute: (input) =>
      executeWithSkillOperationLog("skill_read_asset", input, async () => {
        if (!isRecord(input)) {
          return buildSkillToolErrorResult("Invalid tool input.");
        }

        const skillSelection = resolveSkillSelection(input.skill, {
          allowAllWhenMissing: false,
        });
        if (!skillSelection.ok) {
          return buildSkillToolErrorResult(skillSelection.error);
        }
        const selectedSkill = skillSelection.skills[0];

        const relativePath = readTrimmedString(input.path);
        if (!relativePath) {
          return buildSkillToolErrorResult("path is required.");
        }

        const encoding = readTrimmedString(input.encoding) || "text";
        if (encoding !== "text" && encoding !== "base64") {
          return buildSkillToolErrorResult("encoding must be text or base64.");
        }

        let buffer: Buffer;
        try {
          buffer = await readSkillResourceBuffer({
            skillRoot: selectedSkill.skillRoot,
            kind: "assets",
            relativePath,
          });
        } catch (error) {
          return buildSkillToolErrorResult(readErrorMessage(error));
        }

        const maxChars = normalizeSkillReadMaxChars(input.maxChars);
        const payload =
          encoding === "base64"
            ? buffer.toString("base64")
            : buffer.toString("utf8");
        const clipped = clipTextForSkillTool(payload, maxChars);

        return buildSkillToolResult({
          ok: true,
          skill: selectedSkill.name,
          location: selectedSkill.location,
          path: relativePath,
          encoding,
          sizeBytes: buffer.byteLength,
          truncated: clipped.truncated,
          content: clipped.value,
        });
      }),
  });

  const runScriptTool = tool({
    name: "skill_run_script",
    description:
      "Run executable files from a Skill scripts directory. Use only when the Skill instructions require script execution.",
    parameters: {
      type: "object" as const,
      properties: {
        skill: {
          type: "string" as const,
          description:
            "Optional active Skill name or location. Required when multiple Skills are active.",
        },
        path: {
          type: "string" as const,
          description:
            "Relative script path inside the selected Skill's scripts directory.",
        },
        args: {
          type: "array" as const,
          description: "Optional script arguments.",
          items: {
            type: "string" as const,
          },
        },
        timeoutMs: {
          type: "integer" as const,
          minimum: 1,
          description: "Optional script timeout in milliseconds.",
        },
      },
      required: ["path"],
      additionalProperties: true as const,
    },
    strict: false,
    execute: (input) =>
      executeWithSkillOperationLog("skill_run_script", input, async () => {
        if (!isRecord(input)) {
          return buildSkillToolErrorResult("Invalid tool input.");
        }

        const skillSelection = resolveSkillSelection(input.skill, {
          allowAllWhenMissing: false,
        });
        if (!skillSelection.ok) {
          return buildSkillToolErrorResult(skillSelection.error);
        }
        const selectedSkill = skillSelection.skills[0];

        const relativePath = readTrimmedString(input.path);
        if (!relativePath) {
          return buildSkillToolErrorResult("path is required.");
        }

        const argsResult = readSkillScriptArgs(input.args);
        if (!argsResult.ok) {
          return buildSkillToolErrorResult(argsResult.error);
        }

        const timeoutMs = normalizeSkillScriptTimeout(input.timeoutMs);
        try {
          const scriptEnvironment = buildSkillScriptEnvironment(
            executionContext.threadEnvironment,
          );
          const result = await runSkillScript({
            skillRoot: selectedSkill.skillRoot,
            relativePath,
            args: argsResult.value,
            env: scriptEnvironment,
            timeoutMs,
            outputMaxChars: AGENT_SKILL_SCRIPT_OUTPUT_MAX_CHARS,
          });
          const environmentChanges = applySkillScriptEnvironmentChanges(
            executionContext.threadEnvironment,
            result.environmentChanges,
          );

          if (result.exitCode !== 0) {
            return buildSkillToolResult({
              ok: false,
              error: buildSkillScriptRunFailureMessage(result),
              skill: selectedSkill.name,
              location: selectedSkill.location,
              path: relativePath,
              ...result,
              environmentChanges,
              threadEnvironment: readCurrentThreadEnvironment(),
            });
          }

          return buildSkillToolResult({
            ok: true,
            skill: selectedSkill.name,
            location: selectedSkill.location,
            path: relativePath,
            ...result,
            environmentChanges,
            threadEnvironment: readCurrentThreadEnvironment(),
          });
        } catch (error) {
          return buildSkillToolErrorResult(readErrorMessage(error));
        }
      }),
  });

  const getEnvironmentTool = tool({
    name: "skill_get_environment",
    description:
      "Read thread-scoped environment variables shared across turns.",
    parameters: {
      type: "object" as const,
      properties: {},
      required: [],
      additionalProperties: true as const,
    },
    strict: false,
    execute: (input) =>
      executeWithSkillOperationLog("skill_get_environment", input, () =>
        buildSkillToolResult({
          ok: true,
          threadEnvironment: readCurrentThreadEnvironment(),
        }),
      ),
  });

  const setEnvironmentTool = tool({
    name: "skill_set_environment",
    description:
      "Update thread-scoped environment variables shared across turns. Supports ${VAR} expansion with current environment values.",
    parameters: {
      type: "object" as const,
      properties: {
        variables: {
          type: "object" as const,
          description: `Optional environment key-value map. Keys must match ${ENV_KEY_PATTERN.toString()} and be ${THREAD_ENVIRONMENT_KEY_MAX_LENGTH} characters or fewer.`,
          additionalProperties: {
            type: "string" as const,
          },
        },
        unset: {
          type: "array" as const,
          description: "Optional list of environment variable names to remove.",
          items: {
            type: "string" as const,
          },
        },
      },
      required: [],
      additionalProperties: true as const,
    },
    strict: false,
    execute: (input) =>
      executeWithSkillOperationLog("skill_set_environment", input, () => {
        if (!isRecord(input)) {
          return buildSkillToolErrorResult("Invalid tool input.");
        }

        const variablesResult = parseThreadEnvironmentFromUnknown(
          input.variables,
          {
            strict: true,
            pathLabel: "variables",
          },
        );
        if (!variablesResult.ok) {
          return buildSkillToolErrorResult(variablesResult.error);
        }

        const unsetResult = readUnsetThreadEnvironmentKeys(input.unset);
        if (!unsetResult.ok) {
          return buildSkillToolErrorResult(unsetResult.error);
        }

        const nextKeys = new Set(
          Object.keys(executionContext.threadEnvironment),
        );
        for (const key of Object.keys(variablesResult.value)) {
          nextKeys.add(key);
        }
        for (const key of unsetResult.value) {
          nextKeys.delete(key);
        }
        if (nextKeys.size > THREAD_ENVIRONMENT_VARIABLES_MAX) {
          return buildSkillToolErrorResult(
            `threadEnvironment can include up to ${THREAD_ENVIRONMENT_VARIABLES_MAX} entries.`,
          );
        }

        const updatedKeys: string[] = [];
        for (const [key, value] of Object.entries(variablesResult.value)) {
          const expanded = expandThreadEnvironmentTemplate(
            value,
            executionContext.threadEnvironment,
          );
          if (expanded.length > THREAD_ENVIRONMENT_VALUE_MAX_LENGTH) {
            return buildSkillToolErrorResult(
              `variables["${key}"] exceeds ${THREAD_ENVIRONMENT_VALUE_MAX_LENGTH} characters after expansion.`,
            );
          }
          executionContext.threadEnvironment[key] = expanded;
          updatedKeys.push(key);
        }

        const removedKeys: string[] = [];
        for (const key of unsetResult.value) {
          if (!(key in executionContext.threadEnvironment)) {
            continue;
          }

          delete executionContext.threadEnvironment[key];
          removedKeys.push(key);
        }

        return buildSkillToolResult({
          ok: true,
          updatedKeys,
          removedKeys,
          threadEnvironment: readCurrentThreadEnvironment(),
        });
      }),
  });

  return [
    listResourcesTool,
    readGuideTool,
    readReferenceTool,
    readAssetTool,
    runScriptTool,
    getEnvironmentTool,
    setEnvironmentTool,
  ];
}

function emitSkillActivationOperationLogs(
  runtime: SkillRuntimeContext,
  handlers: {
    nextSequence: () => number;
    onRecord: (record: ThreadOperationLogRecord) => void;
  },
  executionContext: SkillToolExecutionContext,
): void {
  const records = buildInitialSkillOperationRecords(runtime, {
    nextSequence: handlers.nextSequence,
    threadEnvironment: executionContext.threadEnvironment,
  });
  for (const record of records) {
    handlers.onRecord(record);
  }
}

function buildInitialSkillOperationRecords(
  runtime: SkillRuntimeContext,
  options: {
    nextSequence: () => number;
    threadEnvironment: ThreadEnvironment;
  },
): ThreadOperationLogRecord[] {
  const records: ThreadOperationLogRecord[] = [];
  for (const skill of runtime.activeSkills) {
    records.push(buildSkillActivateOperationRecord(skill, options));
    if (skill.guidePreloadRequested) {
      records.push(buildSkillGuideReadOperationRecord(skill, options));
    }
  }
  if (runtime.activeSkills.length > 0) {
    records.push(buildSkillEnvironmentSnapshotOperationRecord(options));
  }
  return records;
}

function buildSkillActivateOperationRecord(
  skill: ActiveSkillRuntimeEntry,
  options: {
    nextSequence: () => number;
    threadEnvironment: ThreadEnvironment;
  },
): ThreadOperationLogRecord {
  const sequence = options.nextSequence();
  const requestId = buildThreadOperationLogRequestId(skill.name, sequence);
  const startedAt = new Date().toISOString();

  return {
    id: requestId,
    sequence,
    operationType: "skill",
    serverName: skill.name,
    method: "skill/activate",
    startedAt,
    completedAt: new Date().toISOString(),
    request: {
      jsonrpc: "2.0",
      id: requestId,
      method: "skill/activate",
      params: {
        name: skill.name,
        location: skill.location,
        preloadMode: skill.guidePreloadRequested
          ? "full_guide"
          : "frontmatter_only",
        threadEnvironment: cloneThreadEnvironment(options.threadEnvironment),
      },
    },
    response: {
      jsonrpc: "2.0",
      id: requestId,
      result: {
        status: "active",
        preloadedFullGuide: skill.preloadedGuideMarkdown !== null,
        resources: {
          scripts: skill.scripts.length,
          references: skill.references.length,
          assets: skill.assets.length,
        },
      },
    },
    isError: false,
  };
}

function buildSkillGuideReadOperationRecord(
  skill: ActiveSkillRuntimeEntry,
  options: {
    nextSequence: () => number;
    threadEnvironment: ThreadEnvironment;
  },
): ThreadOperationLogRecord {
  const sequence = options.nextSequence();
  const requestId = buildThreadOperationLogRequestId(skill.name, sequence);
  const startedAt = new Date().toISOString();
  const request: JsonRpcRequestPayload = {
    jsonrpc: "2.0",
    id: requestId,
    method: "skill_read_guide",
    params: {
      skill: skill.location,
      maxChars: AGENT_SKILL_READ_TEXT_DEFAULT_MAX_CHARS,
      threadEnvironment: cloneThreadEnvironment(options.threadEnvironment),
    },
  };

  if (skill.preloadedGuideMarkdown === null) {
    return {
      id: requestId,
      sequence,
      operationType: "skill",
      serverName: skill.name,
      method: "skill_read_guide",
      startedAt,
      completedAt: new Date().toISOString(),
      request,
      response: {
        jsonrpc: "2.0",
        id: requestId,
        error: {
          message:
            skill.preloadedGuideErrorMessage ??
            `Failed to preload SKILL.md for active Skill "${skill.name}".`,
        },
      },
      isError: true,
    };
  }

  const lineNormalized = skill.preloadedGuideMarkdown.replace(/\r\n?/g, "\n");
  const lines = lineNormalized.split("\n");
  const clipped = clipTextForSkillTool(
    lineNormalized,
    AGENT_SKILL_READ_TEXT_DEFAULT_MAX_CHARS,
  );

  return {
    id: requestId,
    sequence,
    operationType: "skill",
    serverName: skill.name,
    method: "skill_read_guide",
    startedAt,
    completedAt: new Date().toISOString(),
    request,
    response: {
      jsonrpc: "2.0",
      id: requestId,
      result: {
        ok: true,
        skill: skill.name,
        location: skill.location,
        path: "SKILL.md",
        startLine: 1,
        endLine: lines.length,
        totalLines: lines.length,
        truncated: clipped.truncated,
        text: clipped.value,
      },
    },
    isError: false,
  };
}

function buildSkillEnvironmentSnapshotOperationRecord(options: {
  nextSequence: () => number;
  threadEnvironment: ThreadEnvironment;
}): ThreadOperationLogRecord {
  const sequence = options.nextSequence();
  const requestId = buildThreadOperationLogRequestId("skill-runtime", sequence);
  const startedAt = new Date().toISOString();
  const threadEnvironment = cloneThreadEnvironment(options.threadEnvironment);

  return {
    id: requestId,
    sequence,
    operationType: "skill",
    serverName: "skill-runtime",
    method: "skill/environment_snapshot",
    startedAt,
    completedAt: new Date().toISOString(),
    request: {
      jsonrpc: "2.0",
      id: requestId,
      method: "skill/environment_snapshot",
      params: {
        threadEnvironment,
      },
    },
    response: {
      jsonrpc: "2.0",
      id: requestId,
      result: {
        threadEnvironment,
      },
    },
    isError: false,
  };
}

function normalizePathForComparison(value: string | null | undefined): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replaceAll("\\", "/").toLowerCase();
}

function buildSkillResourcePreview(
  skill: ActiveSkillRuntimeEntry,
  selectedCategory: SkillToolCategory | null,
): Record<string, unknown> {
  const categories = selectedCategory
    ? ([selectedCategory] as const)
    : (["scripts", "references", "assets"] as const);
  const payload: Record<string, unknown> = {
    name: skill.name,
    location: skill.location,
  };

  for (const category of categories) {
    const sourceEntries =
      category === "scripts"
        ? skill.scripts
        : category === "references"
          ? skill.references
          : skill.assets;
    const previewEntries = sourceEntries.slice(
      0,
      AGENT_SKILL_TOOL_RESOURCE_PREVIEW_MAX_FILES,
    );
    const categoryTruncated =
      category === "scripts"
        ? skill.scriptsTruncated
        : category === "references"
          ? skill.referencesTruncated
          : skill.assetsTruncated;

    payload[category] = previewEntries.map((entry) => ({
      path: entry.path,
      sizeBytes: entry.sizeBytes,
    }));
    payload[`${category}Total`] = sourceEntries.length;
    payload[`${category}Truncated`] =
      categoryTruncated || sourceEntries.length > previewEntries.length;
  }

  return payload;
}

function buildSkillToolResult(payload: Record<string, unknown>): string {
  return JSON.stringify(payload);
}

function buildSkillToolErrorResult(message: string): string {
  return buildSkillToolResult({
    ok: false,
    error: message,
  });
}

function buildSkillScriptRunFailureMessage(result: {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  stderr: string;
}): string {
  const stderr = result.stderr.trim();
  if (stderr) {
    return stderr;
  }

  if (result.timedOut) {
    return "Skill script timed out.";
  }

  if (result.signal) {
    return `Skill script terminated by signal ${result.signal}.`;
  }

  if (result.exitCode === null) {
    return "Skill script failed with an unknown exit status.";
  }

  return `Skill script exited with code ${result.exitCode}.`;
}

function isSkillOperationErrorResult(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  if (value.ok === false) {
    return true;
  }

  if (Object.hasOwn(value, "exitCode")) {
    return value.exitCode !== 0;
  }

  return false;
}

function readSkillToolCategory(value: unknown): SkillToolCategory | null {
  return value === "scripts" || value === "references" || value === "assets"
    ? value
    : null;
}

function readInteger(value: unknown): number | null {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isSafeInteger(value)
  ) {
    return null;
  }

  return value;
}

function readTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSkillReadMaxChars(value: unknown): number {
  const parsedValue = readInteger(value);
  if (!parsedValue || parsedValue <= 0) {
    return AGENT_SKILL_READ_TEXT_DEFAULT_MAX_CHARS;
  }

  return Math.min(parsedValue, AGENT_SKILL_READ_TEXT_MAX_CHARS);
}

function clipTextForSkillTool(
  value: string,
  maxChars: number,
): {
  value: string;
  truncated: boolean;
} {
  if (value.length <= maxChars) {
    return {
      value,
      truncated: false,
    };
  }

  return {
    value: value.slice(0, maxChars),
    truncated: true,
  };
}

function readSkillScriptArgs(value: unknown): ParseResult<string[]> {
  if (value === undefined) {
    return { ok: true, value: [] };
  }

  if (!Array.isArray(value)) {
    return { ok: false, error: "args must be an array of strings." };
  }

  if (value.length > AGENT_SKILL_SCRIPT_MAX_ARGS) {
    return {
      ok: false,
      error: `args can include up to ${AGENT_SKILL_SCRIPT_MAX_ARGS} values.`,
    };
  }

  const args: string[] = [];
  for (const [index, entry] of value.entries()) {
    if (typeof entry !== "string") {
      return { ok: false, error: `args[${index}] must be a string.` };
    }
    if (entry.length > AGENT_SKILL_SCRIPT_ARG_MAX_LENGTH) {
      return {
        ok: false,
        error: `args[${index}] must be ${AGENT_SKILL_SCRIPT_ARG_MAX_LENGTH} characters or fewer.`,
      };
    }

    args.push(entry);
  }

  return { ok: true, value: args };
}

function normalizeSkillScriptTimeout(value: unknown): number | undefined {
  const parsedValue = readInteger(value);
  if (!parsedValue || parsedValue <= 0) {
    return undefined;
  }

  return Math.min(parsedValue, AGENT_SKILL_SCRIPT_TIMEOUT_MAX_MS);
}

function buildSkillScriptEnvironment(
  threadEnvironment: ThreadEnvironment,
): Record<string, string> {
  const baseEnvironment: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") {
      baseEnvironment[key] = value;
    }
  }

  for (const [key, value] of Object.entries(threadEnvironment)) {
    baseEnvironment[key] = value;
  }

  return buildStdioSpawnEnvironment(baseEnvironment);
}

function applySkillScriptEnvironmentChanges(
  threadEnvironment: ThreadEnvironment,
  changes: {
    captured: boolean;
    updated: Record<string, string>;
    removed: string[];
  },
): {
  captured: boolean;
  updated: string[];
  removed: string[];
  ignored: string[];
} {
  if (!changes.captured) {
    return {
      captured: false,
      updated: [],
      removed: [],
      ignored: [],
    };
  }

  const updatedKeys: string[] = [];
  const ignoredKeys: string[] = [];
  const removedKeys: string[] = [];
  for (const key of changes.removed) {
    if (!(key in threadEnvironment)) {
      continue;
    }

    delete threadEnvironment[key];
    removedKeys.push(key);
  }

  let threadEnvironmentEntryCount = Object.keys(threadEnvironment).length;
  for (const [key, value] of Object.entries(changes.updated)) {
    if (
      key.length > THREAD_ENVIRONMENT_KEY_MAX_LENGTH ||
      !ENV_KEY_PATTERN.test(key) ||
      value.length > THREAD_ENVIRONMENT_VALUE_MAX_LENGTH
    ) {
      ignoredKeys.push(key);
      continue;
    }

    const alreadyExists = key in threadEnvironment;
    if (
      !alreadyExists &&
      threadEnvironmentEntryCount >= THREAD_ENVIRONMENT_VARIABLES_MAX
    ) {
      ignoredKeys.push(key);
      continue;
    }

    threadEnvironment[key] = value;
    if (!alreadyExists) {
      threadEnvironmentEntryCount += 1;
    }
    updatedKeys.push(key);
  }

  return {
    captured: true,
    updated: updatedKeys,
    removed: removedKeys,
    ignored: ignoredKeys,
  };
}

function readUnsetThreadEnvironmentKeys(value: unknown): ParseResult<string[]> {
  if (value === undefined || value === null) {
    return {
      ok: true,
      value: [],
    };
  }

  if (!Array.isArray(value)) {
    return {
      ok: false,
      error: "`unset` must be an array of environment variable names.",
    };
  }

  if (value.length > THREAD_ENVIRONMENT_VARIABLES_MAX) {
    return {
      ok: false,
      error: `\`unset\` can include up to ${THREAD_ENVIRONMENT_VARIABLES_MAX} entries.`,
    };
  }

  const unique = new Set<string>();
  const keys: string[] = [];
  for (const [index, entry] of value.entries()) {
    if (typeof entry !== "string") {
      return {
        ok: false,
        error: `unset[${index}] must be a string.`,
      };
    }

    const key = entry.trim();
    if (
      key.length === 0 ||
      key.length > THREAD_ENVIRONMENT_KEY_MAX_LENGTH ||
      !ENV_KEY_PATTERN.test(key)
    ) {
      return {
        ok: false,
        error:
          `unset[${index}] is invalid. ` +
          `Keys must match ${ENV_KEY_PATTERN.toString()} and be ` +
          `${THREAD_ENVIRONMENT_KEY_MAX_LENGTH} characters or fewer.`,
      };
    }

    if (unique.has(key)) {
      continue;
    }
    unique.add(key);
    keys.push(key);
  }

  return {
    ok: true,
    value: keys,
  };
}

function expandThreadEnvironmentTemplate(
  value: string,
  environment: ThreadEnvironment,
): string {
  return value.replace(
    /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g,
    (_match, variableName: string) => {
      const threadValue = environment[variableName];
      if (typeof threadValue === "string") {
        return threadValue;
      }

      const processValue = process.env[variableName];
      return typeof processValue === "string" ? processValue : "";
    },
  );
}

function readProgressEventFromRunStreamEvent(
  event: unknown,
  hasMcpServers: boolean,
  toolNameByCallId: Map<string, string>,
): ChatProgressEvent | null {
  if (!isRecord(event) || event.type !== "run_item_stream_event") {
    return null;
  }

  const eventName = event.name;
  if (typeof eventName !== "string") {
    return null;
  }

  const item = event.item;

  if (eventName === "tool_called") {
    const toolName = readToolNameFromRunItem(item);
    const callId = readToolCallIdFromRunItem(item);
    if (callId && toolName) {
      toolNameByCallId.set(callId, toolName);
    }

    const toolLabel = toolName || shortenToolCallId(callId);
    return {
      message: hasMcpServers
        ? `Running MCP command: ${toolLabel}`
        : `Running tool: ${toolLabel}`,
      isMcp: hasMcpServers,
    };
  }

  if (eventName === "tool_output") {
    const callId = readToolCallIdFromRunItem(item);
    const knownToolName = callId ? toolNameByCallId.get(callId) : "";
    if (callId) {
      toolNameByCallId.delete(callId);
    }

    const toolName =
      knownToolName ||
      readToolNameFromRunItem(item) ||
      shortenToolCallId(callId);
    const toolErrorMessage = readToolErrorMessageFromRunItem(item);
    if (toolErrorMessage) {
      return {
        message: hasMcpServers
          ? `MCP command failed: ${toolName} (${truncateProgressMessage(toolErrorMessage)})`
          : `Tool failed: ${toolName} (${truncateProgressMessage(toolErrorMessage)})`,
        isMcp: hasMcpServers,
      };
    }

    return {
      message: hasMcpServers
        ? `MCP command finished: ${toolName}`
        : `Tool finished: ${toolName}`,
      isMcp: hasMcpServers,
    };
  }

  if (eventName === "reasoning_item_created") {
    return {
      message: "Reasoning on your request...",
    };
  }

  if (eventName === "message_output_created") {
    return {
      message: "Generating response...",
    };
  }

  return null;
}

function readToolNameFromRunItem(item: unknown): string {
  if (!isRecord(item)) {
    return "";
  }

  if (typeof item.toolName === "string" && item.toolName.trim()) {
    return item.toolName.trim();
  }

  if (!isRecord(item.rawItem)) {
    return "";
  }

  const rawToolName = item.rawItem.name;
  return typeof rawToolName === "string" ? rawToolName.trim() : "";
}

function readToolCallIdFromRunItem(item: unknown): string {
  if (!isRecord(item) || !isRecord(item.rawItem)) {
    return "";
  }

  const rawCallId = item.rawItem.callId;
  return typeof rawCallId === "string" ? rawCallId.trim() : "";
}

function shortenToolCallId(callId: string): string {
  const trimmed = callId.trim();
  if (!trimmed) {
    return "unknown";
  }

  return trimmed.length <= 12 ? trimmed : `${trimmed.slice(0, 12)}...`;
}

function readToolErrorMessageFromRunItem(item: unknown): string {
  if (!isRecord(item)) {
    return "";
  }

  const output =
    "output" in item
      ? item.output
      : isRecord(item.rawItem)
        ? item.rawItem.output
        : null;
  return readSkillOperationErrorMessageFromToolOutput(output);
}

function readSkillOperationErrorMessageFromToolOutput(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const parsedValue = parseToolOutputPayload(value);
  if (!isRecord(parsedValue)) {
    return "";
  }

  const explicitError = readTrimmedString(parsedValue.error);
  if (parsedValue.ok === false && explicitError) {
    return explicitError;
  }

  if (Object.hasOwn(parsedValue, "exitCode")) {
    const exitCode =
      typeof parsedValue.exitCode === "number" &&
      Number.isFinite(parsedValue.exitCode)
        ? parsedValue.exitCode
        : null;
    if (exitCode !== 0) {
      if (explicitError) {
        return explicitError;
      }

      const stderr = readTrimmedString(parsedValue.stderr);
      if (stderr) {
        return stderr;
      }

      return exitCode === null
        ? "Tool returned an unknown exit status."
        : `Tool exited with code ${exitCode}.`;
    }
  }

  return "";
}

function parseToolOutputPayload(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  return throwIfAbortedUsecase(signal);
}

function buildUpstreamErrorPayload(
  error: unknown,
  deploymentName: string,
): {
  payload: UpstreamErrorPayload;
  status: number;
} {
  return buildUpstreamErrorPayloadUsecase(error, deploymentName);
}

function isRequestCanceledError(error: unknown): boolean {
  return isRequestCanceledErrorUsecase(error);
}

function buildUpstreamErrorMessage(
  error: unknown,
  deploymentName: string,
): string {
  return buildUpstreamErrorMessageUsecase(error, deploymentName);
}

function isTransientNetworkTerminationError(error: unknown): boolean {
  return isTransientNetworkTerminationErrorUsecase(error);
}

function shouldRetryChatExecution(
  error: unknown,
  attempt: number,
  maxAttempts: number,
): boolean {
  return shouldRetryChatExecutionUsecase(error, attempt, maxAttempts);
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error.";
}

function sleep(durationMs: number): Promise<void> {
  return sleepUsecase(durationMs);
}

export const chatRouteTestUtils = {
  readTemperature,
  isWebSearchCompatibleReasoningEffort,
  isDeploymentReasoningEffortCompatible,
  readWebSearchEnabled,
  readWebSearchUserLocationFromRequest,
  readInstructionContextToggles,
  readAttachments,
  readThreadEnvironment,
  hasNonPdfAttachments: hasNonPdfAttachmentsUsecase,
  readSkills,
  readExplicitSkillLocations,
  readMcpServers,
  buildMcpHttpRequestHeaders,
  buildMcpContextRequestHeaders,
  buildMcpHttpRuntimeHeaders,
  buildMcpServerSessionConfigKey,
  buildMcpConnectSuccessResponse,
  isLocalPlaygroundMcpContextUrl,
  buildChatExecutionSuccessLogContext,
  createInitialChatMcpRuntimeMetrics,
  normalizeMcpMetaNulls,
  normalizeMcpInitializeNullOptionals,
  normalizeMcpListToolsNullOptionals,
  readProgressEventFromRunStreamEvent,
  buildStdioSpawnEnvironment,
  resolveExecutableCommand,
  isSkillOperationErrorResult,
  buildSkillOperationLoopSignature,
  updateSkillOperationLoopState,
  updateSkillOperationErrorLoopState,
  buildSkillOperationErrorSignature,
  buildRepeatedSkillOperationLoopMessage,
  incrementSkillOperationCount,
  readSkillOperationCallLimit,
  readSkillOperationSignatureCallLimit,
  buildSkillOperationCountExceededMessage,
  buildSkillOperationErrorCountExceededMessage,
  buildSkillOperationSignatureCountExceededMessage,
  shouldCacheSkillOperationResult,
  applySkillScriptEnvironmentChanges,
  buildInitialSkillOperationRecords,
  instrumentMcpServer,
  buildUpstreamErrorMessage,
  buildUpstreamErrorPayload,
  isTransientNetworkTerminationError,
  isRequestCanceledError,
  shouldRetryChatExecution,
  runAgentWithTimeout: runAgentWithTimeoutUsecase,
  throwIfAborted,
  RequestCanceledError: ChatExecutionRequestCanceledError,
  resolveThreadDirectoryPath,
  applyDefaultThreadDirectoryToStdioServers,
};
