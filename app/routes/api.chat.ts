/**
 * API route module for /api/chat.
 */
import type { Route } from "./+types/api.chat";
import {
  Agent,
  tool,
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
} from "~/lib/server/infrastructure/gateways/chat/request-parser";
import { logChatRequestValidationError } from "~/lib/server/infrastructure/gateways/chat/request-validation-log";
import { readSkillMarkdown } from "~/lib/server/infrastructure/gateways/skills/skill-catalog";
import {
  readSkillResourceBuffer,
  readSkillResourceText,
  runSkillScript,
  type SkillResourceKind,
} from "~/lib/server/infrastructure/gateways/skills/skill-runtime";
import { createJsonEventStreamResponse } from "~/lib/server/infrastructure/gateways/chat/json-event-stream";
import { cleanupChatRuntime } from "~/lib/server/usecase/chat/chat-runtime-cleanup";
import { prepareMcpRuntime } from "~/lib/server/usecase/chat/chat-mcp-runtime";
import {
  buildMcpConnectParams,
  buildMcpConnectSuccessResponse,
  buildThreadOperationLogRequestId,
  createMcpServerSession,
  instrumentMcpServer,
  type JsonRpcRequestPayload,
  type JsonRpcResponsePayload,
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
  resolveThreadDirectoryContext,
  resolveThreadDirectoryPath,
} from "~/lib/server/infrastructure/gateways/chat/thread-directory-context";
import { buildSystemInstructionContextPayload } from "~/lib/server/infrastructure/gateways/chat/system-instruction-context";
import {
  buildSkillRuntimeContext,
  collectSkillRuntimeWarnings,
  type ActiveSkillRuntimeEntry,
  type SkillRuntimeContext,
} from "~/lib/server/infrastructure/gateways/skills/chat-skill-runtime";
import {
  emitSkillActivationOperationLogs,
  isSkillOperationErrorResult,
} from "~/lib/server/infrastructure/gateways/skills/skill-operation-records";
import { prepareSkillRuntime } from "~/lib/server/usecase/chat/chat-skill-runtime-preparation";
import {
  buildChatExecutionLogContext,
  buildChatExecutionSuccessLogContext,
} from "~/lib/server/usecase/chat/chat-execution-log-context";
import {
  buildStdioSpawnEnvironment,
  resolveExecutableCommand,
} from "~/lib/server/infrastructure/gateways/chat/stdio-runtime-path";
import { buildAgentRunContext } from "~/lib/server/usecase/chat/agent-run-context";
import {
  createAzureOpenAIClient,
  getAzureBearerTokenForScope,
} from "~/lib/server/infrastructure/gateways/azure/azure-openai-gateway";
import {
  type ChatExecutionOptions,
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
import {
  buildRepeatedSkillOperationLoopMessage,
  buildSkillOperationCountExceededMessage,
  buildSkillOperationErrorCountExceededMessage,
  buildSkillOperationErrorSignature,
  buildSkillOperationLoopSignature,
  buildSkillOperationSignatureCountExceededMessage,
  incrementSkillOperationCount,
  readSkillOperationCallLimit,
  readSkillOperationSignatureCallLimit,
  shouldCacheSkillOperationResult,
  updateSkillOperationErrorLoopState,
  updateSkillOperationLoopState,
} from "~/lib/server/usecase/chat/skill-operation-loop";
import { applySkillScriptEnvironmentChanges } from "~/lib/server/usecase/chat/skill-script-environment";
import {
  applyDefaultThreadDirectoryToStdioServers,
  buildMcpServerSessionConfigKey,
} from "~/lib/server/usecase/chat/mcp-server-config-normalization";
import { clipTextForSkillTool } from "~/lib/server/usecase/chat/skill-tool-text";

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };
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

function createInitialChatMcpRuntimeMetrics(): ChatMcpRuntimeMetrics {
  return createInitialChatMcpRuntimeMetricsUsecase();
}

function toSerializableValue(value: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
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
