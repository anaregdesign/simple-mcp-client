/**
 * API route module for /api/chat.
 */
import type { Route } from "./+types/api.chat";
import nodeOs from "node:os";
import path from "node:path";
import {
  Agent,
  MCPServerSSE,
  MCPServerStdio,
  MCPServerStreamableHttp,
  assistant,
  run,
  tool,
  user,
  type AgentInputItem,
  type MCPServer,
  type OpenAIResponsesCompactionAwareSession,
} from "@openai/agents";
import {
  OpenAIResponsesCompactionSession,
  OpenAIResponsesModel,
  codeInterpreterTool,
} from "@openai/agents-openai";
import { toFile } from "openai";
import { getAzureDependencies } from "~/lib/azure/dependencies";
import {
  resolveFoundryWorkspaceThreadDirectory,
  resolveFoundryWorkspaceUserDirectory,
} from "~/lib/foundry/config";
import { buildMcpServerConfigKey } from "~/lib/mcp/config-key";
import {
  acquireThreadMcpServerSession,
  type ThreadMcpServerSession,
  type ThreadMcpServerSessionLease,
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
  CHAT_CLEANUP_TIMEOUT_MS,
  CHAT_CODE_INTERPRETER_UPLOAD_TIMEOUT_MS,
  CODE_INTERPRETER_ATTACHMENT_AVAILABILITY_CACHE_MS,
  CHAT_ATTACHMENT_MAX_FILE_NAME_LENGTH,
  CHAT_ATTACHMENT_MAX_FILES,
  CHAT_ATTACHMENT_MAX_NON_PDF_FILE_SIZE_BYTES,
  CHAT_ATTACHMENT_MAX_PDF_FILE_SIZE_BYTES,
  CHAT_ATTACHMENT_MAX_PDF_TOTAL_SIZE_BYTES,
  CHAT_ATTACHMENT_MAX_TOTAL_SIZE_BYTES,
  CHAT_MAX_CONSECUTIVE_IDENTICAL_SKILL_OPERATIONS,
  CHAT_MAX_IDENTICAL_SKILL_OPERATION_CALLS_PER_SIGNATURE,
  CHAT_MAX_IDENTICAL_SKILL_RUN_SCRIPT_CALLS_PER_SIGNATURE,
  CHAT_MAX_SKILL_OPERATION_CALLS_PER_SERVER_METHOD,
  CHAT_MAX_SKILL_RUN_SCRIPT_CALLS_PER_SERVER_METHOD,
  CHAT_MAX_SKILL_OPERATION_ERRORS,
  CHAT_MAX_RUN_TURNS,
  CHAT_MODEL_RUN_TIMEOUT_MS,
  DEFAULT_AGENT_INSTRUCTION,
  AGENT_SKILL_PROMPT_RESOURCE_PREVIEW_MAX_FILES,
  AGENT_SKILL_READ_TEXT_DEFAULT_MAX_CHARS,
  AGENT_SKILL_READ_TEXT_MAX_CHARS,
  AGENT_SKILL_SCRIPT_ARG_MAX_LENGTH,
  AGENT_SKILL_SCRIPT_MAX_ARGS,
  AGENT_SKILL_SCRIPT_OUTPUT_MAX_CHARS,
  AGENT_SKILL_SCRIPT_TIMEOUT_MAX_MS,
  AGENT_SKILL_TOOL_RESOURCE_PREVIEW_MAX_FILES,
  AGENT_SKILL_NAME_MAX_LENGTH,
  ENV_KEY_PATTERN,
  MCP_DEFAULT_AZURE_AUTH_SCOPE,
  MCP_DEFAULT_HTTP_HEADERS,
  MCP_LOCAL_PLAYGROUND_CLIENT_PLATFORM_HEADER,
  MCP_LOCAL_PLAYGROUND_CLIENT_USER_AGENT_HEADER,
  MCP_LOCAL_PLAYGROUND_THREAD_ID_HEADER,
  MCP_LOCAL_PLAYGROUND_TURN_ID_HEADER,
  MCP_SERVER_NAME_MAX_LENGTH,
  THREAD_MCP_SERVER_SESSION_IDLE_TTL_MS,
  THREAD_ENVIRONMENT_KEY_MAX_LENGTH,
  THREAD_ENVIRONMENT_VALUE_MAX_LENGTH,
  THREAD_ENVIRONMENT_VARIABLES_MAX,
} from "~/lib/constants";
import type { AzureDependencies } from "~/lib/azure/dependencies";
import type { ReasoningEffort } from "~/lib/home/shared/view-types";
import {
  cloneThreadEnvironment,
  parseThreadEnvironmentFromUnknown,
  type ThreadEnvironment,
} from "~/lib/home/thread/environment";
import {
  type ThreadInstructionContextToggles,
} from "~/lib/home/thread/instruction-context";
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
  type ClientAttachment,
  type ClientMcpServerConfig,
  type ClientMessage,
  type ClientSkillSelection,
  type ResolvedAzureConfig,
} from "~/lib/server/chat/request-parser";
import { logChatRequestValidationError } from "~/lib/server/chat/request-validation-log";
import {
  readAzureArmUserContext,
  type AzurePrincipalType,
} from "~/lib/server/auth/azure-user";
import { ensurePersistenceDatabaseReady, prisma } from "~/lib/server/persistence/prisma";
import { getOrCreateUserByIdentity } from "~/lib/server/persistence/user";
import { readSkillFrontmatter, readSkillMarkdown } from "~/lib/server/skills/catalog";
import {
  inspectSkillResourceManifest,
  readSkillResourceBuffer,
  readSkillResourceText,
  runSkillScript,
  type SkillResourceFileEntry,
  type SkillResourceKind,
} from "~/lib/server/skills/runtime";
import { createJsonEventStreamResponse } from "~/lib/server/chat/json-event-stream";
import {
  buildAgentRunContext,
  cleanupChatRuntime,
  prepareMcpRuntime,
  prepareSkillRuntime,
} from "~/lib/server/chat/chat-runtime-stages";
import {
  readOptionalRequestHeaderValue,
  readWebSearchUserLocationFromRequest,
  wantsEventStream,
  type WebSearchPreviewUserLocation,
} from "~/lib/server/chat/request-metadata";
import {
  buildStdioSpawnEnvironment,
  resolveExecutableCommand,
} from "~/lib/server/chat/stdio-runtime-path";

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };
const chatTransientTerminationRetryMaxAttempts = 2;
const chatTransientTerminationRetryDelayMs = 250;
type ClientMcpHttpServerConfig = Extract<
  ClientMcpServerConfig,
  { transport: "streamable_http" | "sse" }
>;
type UpstreamErrorPayload = {
  code: string;
  error: string;
  errorCode?: "azure_login_required";
};
class RequestCanceledError extends Error {
  constructor(message = "Request was canceled.") {
    super(message);
    this.name = "RequestCanceledError";
  }
}
type ChatExecutionOptions = {
  threadId: string | null;
  turnId: string | null;
  userId: number | null;
  clientUserAgent: string | null;
  clientPlatform: string | null;
  message: string;
  attachments: ClientAttachment[];
  history: ClientMessage[];
  reasoningEffort: ReasoningEffort | null;
  webSearchEnabled: boolean;
  webSearchUserLocation: WebSearchPreviewUserLocation | null;
  temperature: number | null;
  agentInstruction: string;
  instructionContextToggles: ThreadInstructionContextToggles;
  threadEnvironment: ThreadEnvironment;
  skills: ClientSkillSelection[];
  explicitSkillLocations: string[];
  azureConfig: ResolvedAzureConfig;
  mcpServers: ClientMcpServerConfig[];
};
type InstructionClientOperatingSystemContext = {
  name: string;
  version: string | null;
  source: "sec-ch-ua-platform" | "user-agent" | "unknown";
};
type InstructionServerOperatingSystemContext = {
  name: string;
  platform: NodeJS.Platform;
  release: string;
  architecture: string;
};
type SystemInstructionContextPayload = {
  userContext: {
    userId: number | null;
    workspaceDirectoryPath: string | null;
  };
  threadContext: {
    threadId: string | null;
    turnId: string | null;
  };
  systemContext: {
    clientOperatingSystem: InstructionClientOperatingSystemContext;
    serverOperatingSystem: InstructionServerOperatingSystemContext;
  };
  latestThreadName: string | null;
  azureContext: {
    principalDisplayName: string | null;
    principalName: string | null;
    principalType: "User" | "Service Principal" | "Managed Identity" | "Unknown";
    tenantId: string | null;
    principalId: string | null;
    playgroundProject: string | null;
    playgroundProjectId: string | null;
    playgroundDeployment: string | null;
    endpoint: string | null;
    apiVersion: string | null;
  };
};
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
type CodeInterpreterAttachmentAvailabilityCache = {
  supported: boolean;
  checkedAt: number;
  reason: string;
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
type ActiveSkillRuntimeEntry = {
  name: string;
  description: string;
  location: string;
  guidePreloadRequested: boolean;
  preloadedGuideErrorMessage: string | null;
  preloadedGuideMarkdown: string | null;
  skillRoot: string;
  scripts: SkillResourceFileEntry[];
  references: SkillResourceFileEntry[];
  assets: SkillResourceFileEntry[];
  scriptsTruncated: boolean;
  referencesTruncated: boolean;
  assetsTruncated: boolean;
};
type SkillRuntimeContext = {
  activeSkills: ActiveSkillRuntimeEntry[];
  warnings: string[];
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

let codeInterpreterAttachmentAvailabilityCache: CodeInterpreterAttachmentAvailabilityCache | null =
  null;
const WEB_SEARCH_PREVIEW_TOOL_NAME = "web_search_preview";
const WEB_SEARCH_PREVIEW_CONTEXT_SIZE = "medium";
const CHAT_ALLOWED_METHODS = ["POST"] as const;

registerThreadMcpServerSessionPoolShutdownHooks();

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
    clientPlatform: readOptionalRequestHeaderValue(request, "sec-ch-ua-platform"),
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
    eventName: streamRequested ? "chat_stream_request_received" : "chat_request_received",
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
    const upstreamError = buildUpstreamErrorPayload(error, azureConfig.deploymentName);
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
  throwIfAborted(abortSignal);
  const azureDependencies = getAzureDependencies();
  const azureOpenAIClient = getAzureOpenAIClient(
    options.azureConfig.baseUrl,
    options.azureConfig.tenantId,
    azureDependencies,
  );
  const connectedMcpServers: MCPServer[] = [];
  const connectedMcpServerLeases: ThreadMcpServerSessionLease[] = [];
  let codeInterpreterContainerId = "";
  const toolNameByCallId = new Map<string, string>();
  let operationLogSequence = 0;
  const hasMcpServers = options.mcpServers.length > 0;
  const azureMcpAuthorizationTokenPromiseByScope = new Map<string, Promise<string>>();
  const mcpRuntimeMetrics = createInitialChatMcpRuntimeMetrics();
  const mcpRequestContext: McpRequestContext = {
    threadId: options.threadId,
    turnId: options.turnId,
    clientUserAgent: options.clientUserAgent,
    clientPlatform: options.clientPlatform,
  };

  const emitProgress = (event: ChatProgressEvent) => {
    onEvent?.({
      type: "progress",
      message: event.message,
      ...(event.isMcp ? { isMcp: true } : {}),
    });
  };
  const emitThreadOperationLogRecord = (record: ThreadOperationLogRecord) => {
    onEvent?.({
      type: "operation_log",
      record,
    });
  };
  const nextThreadOperationLogSequence = () => {
    operationLogSequence += 1;
    return operationLogSequence;
  };

  try {
    if (hasMcpServers) {
      emitProgress({
        message: `Preparing MCP server connections (${options.mcpServers.length})...`,
        isMcp: true,
      });
    }

    const mcpRuntime = await prepareMcpRuntime({
      serverConfigs: options.mcpServers,
      connectServer: async (serverConfig) => {
        emitProgress({
          message: `Connecting MCP server: ${serverConfig.name}`,
          isMcp: true,
        });

        const connectSequence = nextThreadOperationLogSequence();
        const connectRequestId = buildThreadOperationLogRequestId(serverConfig.name, connectSequence);
        const connectStartedAtMs = Date.now();
        const connectStartedAt = new Date(connectStartedAtMs).toISOString();
        const connectRequest: JsonRpcRequestPayload = {
          jsonrpc: "2.0",
          id: connectRequestId,
          method: "server/connect",
          params: buildMcpConnectParams(serverConfig),
        };

        try {
          const lease = await acquireThreadMcpServerSession({
            threadId: options.threadId,
            sessionKey: buildMcpServerSessionConfigKey(serverConfig),
            refreshState: {
              requestContext: mcpRequestContext,
              getAzureAuthorizationToken: (scope) => {
                const normalizedScope = scope.trim();
                const current = azureMcpAuthorizationTokenPromiseByScope.get(normalizedScope);
                if (current) {
                  return current;
                }

                const created = getAzureMcpAuthorizationToken(
                  normalizedScope,
                  options.azureConfig.tenantId,
                  azureDependencies,
                );
                azureMcpAuthorizationTokenPromiseByScope.set(normalizedScope, created);
                return created;
              },
              logHandlers: {
                nextSequence: nextThreadOperationLogSequence,
                onRecord: emitThreadOperationLogRecord,
              },
            },
            idleTtlMs: THREAD_MCP_SERVER_SESSION_IDLE_TTL_MS,
            createSession: async () => createMcpServerSession(serverConfig),
          });

          emitThreadOperationLogRecord({
            id: connectRequestId,
            sequence: connectSequence,
            operationType: "mcp",
            serverName: serverConfig.name,
            method: "server/connect",
            startedAt: connectStartedAt,
            completedAt: new Date().toISOString(),
            request: connectRequest,
            response: buildMcpConnectSuccessResponse(connectRequestId, lease.status),
            isError: false,
          });
          emitProgress({
            message: lease.status === "reused"
              ? `Reused MCP server: ${serverConfig.name}`
              : `Connected MCP server: ${serverConfig.name}`,
            isMcp: true,
          });

          return {
            lease,
            server: lease.server,
            connectDurationMs: Math.max(0, Date.now() - connectStartedAtMs),
          };
        } catch (error) {
          const connectResponse: JsonRpcResponsePayload = {
            jsonrpc: "2.0",
            id: connectRequestId,
            error: {
              message: readErrorMessage(error),
            },
          };
          emitThreadOperationLogRecord({
            id: connectRequestId,
            sequence: connectSequence,
            operationType: "mcp",
            serverName: serverConfig.name,
            method: "server/connect",
            startedAt: connectStartedAt,
            completedAt: new Date().toISOString(),
            request: connectRequest,
            response: connectResponse,
            isError: true,
          });
          throw new Error(
            `Failed to connect MCP server "${serverConfig.name}" (${describeMcpServer(serverConfig)}): ${readErrorMessage(error)}`,
          );
        }
      },
      releaseLease: async (lease) => lease.release(),
    });
    connectedMcpServerLeases.push(...mcpRuntime.leases);
    connectedMcpServers.push(...mcpRuntime.servers);
    Object.assign(mcpRuntimeMetrics, mcpRuntime.metrics);

    const preparedSkillRuntime = await prepareSkillRuntime({
      loadRuntime: async () =>
        buildSkillRuntimeContext(options.skills, {
          explicitSkillLocations: options.explicitSkillLocations,
        }),
      createExecutionContext: (skillRuntime) =>
        skillRuntime.activeSkills.length > 0
          ? {
              threadEnvironment: cloneThreadEnvironment(options.threadEnvironment),
            }
          : null,
      emitActivationLogs: (skillRuntime, skillExecutionContext) => {
        emitSkillActivationOperationLogs(skillRuntime, {
          nextSequence: nextThreadOperationLogSequence,
          onRecord: emitThreadOperationLogRecord,
        }, skillExecutionContext);
      },
      collectWarnings: (skillRuntime) => collectSkillRuntimeWarnings(skillRuntime),
    });
    const skillRuntime = preparedSkillRuntime.runtime;
    const skillExecutionContext = preparedSkillRuntime.executionContext;
    const skillWarnings = preparedSkillRuntime.warnings;
    if (skillWarnings.length > 0) {
      emitProgress({
        message: `Skill loading warnings: ${skillWarnings.slice(0, 2).join(" / ")}`,
      });
    }
    const implicitSystemInstructionContext = options.instructionContextToggles.system
      ? await buildSystemInstructionContextPayload(options)
      : null;

    emitProgress({ message: "Initializing model and agent..." });

    const model = new OpenAIResponsesModel(
      azureOpenAIClient,
      options.azureConfig.deploymentName,
    );
    const webSearchTools = options.webSearchEnabled
      ? [buildWebSearchPreviewTool(options.webSearchUserLocation)]
      : [];
    if (options.webSearchEnabled) {
      emitProgress({ message: "Enabling web-search-preview tool..." });
    }
    const useCodeInterpreter = shouldEnableCodeInterpreter(options);
    let codeInterpreterEnabledForRun = false;
    if (useCodeInterpreter) {
      emitProgress({ message: "Enabling Code Interpreter for non-PDF attachments..." });
      const nonPdfAttachments = collectNonPdfAttachments(options);
      if (nonPdfAttachments.length > 0) {
        const cachedAvailability = readCodeInterpreterAttachmentAvailabilityCache();
        if (cachedAvailability && !cachedAvailability.supported) {
          emitProgress({
            message:
              "Code Interpreter file upload is temporarily unavailable; continuing without non-PDF file access.",
          });
        } else {
          emitProgress({
            message: `Uploading attachments for Code Interpreter (${nonPdfAttachments.length})...`,
          });
          try {
            codeInterpreterContainerId = await createCodeInterpreterContainerWithAttachments(
              nonPdfAttachments,
              azureOpenAIClient,
            );
            codeInterpreterEnabledForRun = true;
            markCodeInterpreterAttachmentAvailabilitySupported();
          } catch (error) {
            const reason = readErrorMessage(error);
            markCodeInterpreterAttachmentAvailabilityUnavailable(reason);
            emitProgress({
              message: `Code Interpreter file upload failed (${truncateProgressMessage(reason)}). Continuing without non-PDF file access.`,
            });
          }
        }
      } else {
        codeInterpreterEnabledForRun = true;
      }
    }

    const enableCodeInterpreterTool =
      codeInterpreterEnabledForRun && codeInterpreterContainerId.length > 0;
    const skillTools = skillExecutionContext
      ? buildSkillTools(skillRuntime.activeSkills, {
          nextSequence: nextThreadOperationLogSequence,
          onRecord: emitThreadOperationLogRecord,
        }, skillExecutionContext)
      : [];

    const agent = new Agent({
      name: "LocalPlaygroundAgent",
      instructions: buildAgentInstructionWithSkills(options.agentInstruction, skillRuntime, {
        instructionContextToggles: options.instructionContextToggles,
        systemInstructionContext: implicitSystemInstructionContext,
      }),
      model,
      modelSettings: {
        ...(options.temperature !== null ? { temperature: options.temperature } : {}),
        ...(options.reasoningEffort ? { reasoning: { effort: options.reasoningEffort } } : {}),
      },
      tools: [
        ...webSearchTools,
        ...(enableCodeInterpreterTool
          ? [
              codeInterpreterTool({
                container: codeInterpreterContainerId,
              }),
            ]
          : []),
        ...skillTools,
      ],
      mcpServers: connectedMcpServers,
    });

    const historyInput = options.history.map((entry) =>
      entry.role === "user"
        ? buildUserMessageInput(entry.content, entry.attachments, {
            useCodeInterpreter: enableCodeInterpreterTool,
          })
        : assistant(entry.content),
    );
    const currentInput = buildUserMessageInput(options.message, options.attachments, {
      useCodeInterpreter: enableCodeInterpreterTool,
    });
    const compactionSession = await initializeCompactionSession({
      client: azureOpenAIClient,
      deploymentName: options.azureConfig.deploymentName,
      historyInput,
      onCompactionUnavailable: () => {
        emitProgress({
          message:
            "Automatic context compaction is unavailable for this deployment; continuing without it.",
        });
      },
    });
    const { runInput } = buildAgentRunContext({
      historyInput,
      currentInput,
      compactionSession,
    });

    emitProgress({ message: "Sending request to Azure OpenAI..." });
    const runTimeoutSeconds = Math.ceil(CHAT_MODEL_RUN_TIMEOUT_MS / 1000);
    const runTimeoutMessage = useCodeInterpreter
      ? `Azure OpenAI request timed out after ${runTimeoutSeconds} seconds while processing file attachments. The selected deployment may not support Code Interpreter.`
      : `Azure OpenAI request timed out after ${runTimeoutSeconds} seconds.`;

    if (onEvent) {
      const streamedResult = await runAgentWithTimeout(
        (signal) =>
          run(agent, runInput, {
            stream: true,
            signal,
            maxTurns: CHAT_MAX_RUN_TURNS,
            ...(compactionSession ? { session: compactionSession } : {}),
          }),
        CHAT_MODEL_RUN_TIMEOUT_MS,
        runTimeoutMessage,
        abortSignal,
      );
      for await (const event of streamedResult) {
        const progress = readProgressEventFromRunStreamEvent(
          event,
          hasMcpServers,
          toolNameByCallId,
        );
        if (progress) {
          emitProgress(progress);
        }
      }

      await awaitWithTimeout(
        streamedResult.completed,
        CHAT_MODEL_RUN_TIMEOUT_MS,
        runTimeoutMessage,
      );

      const assistantMessage = extractAgentFinalOutput(streamedResult.finalOutput);
      if (!assistantMessage) {
        throw new Error("Azure OpenAI returned an empty message.");
      }

      emitProgress({ message: "Finalizing response..." });
      const nextThreadEnvironment = skillExecutionContext
        ? cloneThreadEnvironment(skillExecutionContext.threadEnvironment)
        : cloneThreadEnvironment(options.threadEnvironment);
      return {
        message: assistantMessage,
        threadEnvironment: nextThreadEnvironment,
        operationLogCount: operationLogSequence,
        mcpRuntimeMetrics,
      };
    }

    const result = await runAgentWithTimeout(
      (signal) =>
        run(agent, runInput, {
          signal,
          maxTurns: CHAT_MAX_RUN_TURNS,
          ...(compactionSession ? { session: compactionSession } : {}),
        }),
      CHAT_MODEL_RUN_TIMEOUT_MS,
      runTimeoutMessage,
      abortSignal,
    );
    const assistantMessage = extractAgentFinalOutput(result.finalOutput);
    if (!assistantMessage) {
      throw new Error("Azure OpenAI returned an empty message.");
    }

    const nextThreadEnvironment = skillExecutionContext
      ? cloneThreadEnvironment(skillExecutionContext.threadEnvironment)
      : cloneThreadEnvironment(options.threadEnvironment);
    return {
      message: assistantMessage,
      threadEnvironment: nextThreadEnvironment,
      operationLogCount: operationLogSequence,
      mcpRuntimeMetrics,
    };
  } finally {
    await cleanupChatRuntime({
      codeInterpreterContainerId,
      deleteCodeInterpreterContainer: async (containerId) => {
        try {
          await azureOpenAIClient.containers.delete(containerId);
        } catch {
          // Best-effort cleanup for temporary Code Interpreter containers.
        }
      },
      mcpServerLeases: connectedMcpServerLeases,
      awaitWithTimeout,
      cleanupTimeoutMs: CHAT_CLEANUP_TIMEOUT_MS,
    });
  }
}

async function executeChatWithTransientRetry(
  options: ChatExecutionOptions,
  onEvent?: (event: ChatExecutionEvent) => void,
  abortSignal?: AbortSignal,
): Promise<ChatExecutionResult> {
  for (let attempt = 1; attempt <= chatTransientTerminationRetryMaxAttempts; attempt += 1) {
    try {
      throwIfAborted(abortSignal);
      return await executeChat(options, onEvent, abortSignal);
    } catch (error) {
      if (abortSignal?.aborted) {
        throw error;
      }
      if (
        !shouldRetryChatExecution(
          error,
          attempt,
          chatTransientTerminationRetryMaxAttempts,
        )
      ) {
        throw error;
      }

      onEvent?.({
        type: "progress",
        message:
          `Azure OpenAI connection was interrupted. ` +
          `Retrying (${attempt + 1}/${chatTransientTerminationRetryMaxAttempts})...`,
      });
      await sleep(chatTransientTerminationRetryDelayMs);
    }
  }

  throw new Error("Azure OpenAI request failed after retry.");
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

      const result = await executeChatWithTransientRetry(options, (event) => {
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
      }, signal);

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

function buildChatExecutionLogContext(options: ChatExecutionOptions): Record<string, unknown> {
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
    webSearchUserLocationCountry: options.webSearchUserLocation?.country ?? null,
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

function buildWebSearchPreviewTool(userLocation: WebSearchPreviewUserLocation | null) {
  return {
    type: "hosted_tool" as const,
    name: WEB_SEARCH_PREVIEW_TOOL_NAME,
    providerData: {
      type: "web_search_preview",
      name: WEB_SEARCH_PREVIEW_TOOL_NAME,
      search_context_size: WEB_SEARCH_PREVIEW_CONTEXT_SIZE,
      ...(userLocation ? { user_location: userLocation } : {}),
    },
  };
}

function shouldEnableCodeInterpreter(options: ChatExecutionOptions): boolean {
  if (hasNonPdfAttachments(options.attachments)) {
    return true;
  }

  return options.history.some(
    (entry) => entry.role === "user" && hasNonPdfAttachments(entry.attachments),
  );
}

function hasNonPdfAttachments(attachments: ClientAttachment[]): boolean {
  return attachments.some((attachment) => readFileExtension(attachment.name) !== "pdf");
}

function collectNonPdfAttachments(options: ChatExecutionOptions): ClientAttachment[] {
  const dedupedByKey = new Map<string, ClientAttachment>();

  const register = (attachment: ClientAttachment) => {
    if (readFileExtension(attachment.name) === "pdf") {
      return;
    }
    dedupedByKey.set(buildAttachmentKey(attachment), attachment);
  };

  for (const attachment of options.attachments) {
    register(attachment);
  }
  for (const historyEntry of options.history) {
    if (historyEntry.role !== "user") {
      continue;
    }
    for (const attachment of historyEntry.attachments) {
      register(attachment);
    }
  }

  return [...dedupedByKey.values()];
}

async function createCodeInterpreterContainerWithAttachments(
  attachments: ClientAttachment[],
  client: ReturnType<AzureDependencies["getAzureOpenAIClient"]>,
): Promise<string> {
  const container = await awaitWithTimeout(
    client.containers.create({
      name: "local-playground-chat",
    }),
    CHAT_CODE_INTERPRETER_UPLOAD_TIMEOUT_MS,
    "Timed out while creating a Code Interpreter container.",
  );
  const containerId = typeof container.id === "string" ? container.id.trim() : "";
  if (!containerId) {
    throw new Error("Failed to initialize a Code Interpreter container.");
  }

  try {
    for (const attachment of attachments) {
      const parsedAttachmentDataUrl = parseAttachmentDataUrl(
        attachment.dataUrl,
        `attachments["${attachment.name}"].dataUrl`,
      );
      if (!parsedAttachmentDataUrl.ok) {
        throw new Error(parsedAttachmentDataUrl.error);
      }

      const base64Payload = readDataUrlBase64Payload(parsedAttachmentDataUrl.value.dataUrl);
      const attachmentBuffer = Buffer.from(base64Payload, "base64");
      const normalizedMimeType =
        attachment.mimeType ||
        parsedAttachmentDataUrl.value.mimeType ||
        "application/octet-stream";
      const file = await toFile(attachmentBuffer, attachment.name, { type: normalizedMimeType });
      try {
        await awaitWithTimeout(
          client.containers.files.create(containerId, { file }),
          CHAT_CODE_INTERPRETER_UPLOAD_TIMEOUT_MS,
          `Timed out while uploading "${attachment.name}" to Code Interpreter.`,
        );
      } catch (error) {
        throw buildCodeInterpreterAttachmentUploadError(attachment.name, error);
      }
    }

    return containerId;
  } catch (error) {
    try {
      await client.containers.delete(containerId);
    } catch {
      // Best-effort cleanup when attachment upload fails.
    }
    throw error;
  }
}

function buildCodeInterpreterAttachmentUploadError(
  fileName: string,
  error: unknown,
): Error {
  const message = readErrorMessage(error);
  if (
    /unsupported extension/i.test(message) ||
    /invalid filename/i.test(message) ||
    /filename contains an invalid filename/i.test(message)
  ) {
    return new Error(
      `Code Interpreter rejected "${fileName}" on this deployment. ${message}`,
    );
  }

  return new Error(`Failed to upload attachment "${fileName}" for Code Interpreter: ${message}`);
}

function readCodeInterpreterAttachmentAvailabilityCache():
  | CodeInterpreterAttachmentAvailabilityCache
  | null {
  const cache = codeInterpreterAttachmentAvailabilityCache;
  if (!cache) {
    return null;
  }

  if (Date.now() - cache.checkedAt > CODE_INTERPRETER_ATTACHMENT_AVAILABILITY_CACHE_MS) {
    codeInterpreterAttachmentAvailabilityCache = null;
    return null;
  }

  return cache;
}

function markCodeInterpreterAttachmentAvailabilitySupported(): void {
  codeInterpreterAttachmentAvailabilityCache = {
    supported: true,
    checkedAt: Date.now(),
    reason: "",
  };
}

function markCodeInterpreterAttachmentAvailabilityUnavailable(reason: string): void {
  codeInterpreterAttachmentAvailabilityCache = {
    supported: false,
    checkedAt: Date.now(),
    reason: reason.trim(),
  };
}

function truncateProgressMessage(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) {
    return "unknown error";
  }

  const maxLength = 120;
  return trimmed.length <= maxLength ? trimmed : `${trimmed.slice(0, maxLength - 1)}...`;
}

function buildUserMessageInput(
  content: string,
  attachments: ClientAttachment[],
  options: {
    useCodeInterpreter: boolean;
  },
) {
  if (attachments.length === 0) {
    return user(content);
  }

  const pdfAttachments = attachments.filter(
    (attachment) => readFileExtension(attachment.name) === "pdf",
  );
  const codeInterpreterAttachmentNames = attachments
    .filter((attachment) => readFileExtension(attachment.name) !== "pdf")
    .filter(() => options.useCodeInterpreter)
    .map((attachment) => attachment.name);

  if (pdfAttachments.length === 0 && codeInterpreterAttachmentNames.length === 0) {
    return user(content);
  }

  const textWithAttachmentHint =
    codeInterpreterAttachmentNames.length > 0
      ? [
          content,
          "",
          "Files available in Code Interpreter:",
          ...codeInterpreterAttachmentNames.map((name) => `- ${name}`),
        ].join("\n")
      : content;

  const inputContent = [
    {
      type: "input_text" as const,
      text: textWithAttachmentHint,
    },
    ...pdfAttachments.map((attachment) => ({
      type: "input_file" as const,
      file: attachment.dataUrl,
      filename: attachment.name,
    })),
  ];
  return user(inputContent);
}

function extractAgentFinalOutput(finalOutput: unknown): string {
  if (typeof finalOutput === "string") {
    return finalOutput.trim();
  }
  if (typeof finalOutput === "number" || typeof finalOutput === "boolean") {
    return String(finalOutput);
  }
  if (finalOutput && typeof finalOutput === "object") {
    try {
      return JSON.stringify(finalOutput);
    } catch {
      return "";
    }
  }
  return "";
}

function getAzureOpenAIClient(
  baseUrl: string,
  tenantId: string,
  dependencies: AzureDependencies,
) {
  return dependencies.getAzureOpenAIClient(baseUrl, tenantId);
}

async function initializeCompactionSession(options: {
  client: ReturnType<AzureDependencies["getAzureOpenAIClient"]>;
  deploymentName: string;
  historyInput: AgentInputItem[];
  onCompactionUnavailable: () => void;
}): Promise<OpenAIResponsesCompactionAwareSession | null> {
  let session: OpenAIResponsesCompactionSession;
  try {
    session = new OpenAIResponsesCompactionSession({
      client: options.client,
      model: options.deploymentName,
    });
  } catch {
    options.onCompactionUnavailable();
    return null;
  }

  const resilientSession = createResilientCompactionSession(
    session,
    options.onCompactionUnavailable,
  );

  try {
    if (options.historyInput.length > 0) {
      await resilientSession.addItems(options.historyInput);
    }
  } catch {
    options.onCompactionUnavailable();
    return null;
  }

  return resilientSession;
}

function createResilientCompactionSession(
  baseSession: OpenAIResponsesCompactionSession,
  onCompactionUnavailable: () => void,
): OpenAIResponsesCompactionAwareSession {
  let compactionEnabled = true;
  let hasNotifiedFailure = false;

  return {
    getSessionId: () => baseSession.getSessionId(),
    getItems: (limit) => baseSession.getItems(limit),
    addItems: (items) => baseSession.addItems(items),
    popItem: () => baseSession.popItem(),
    clearSession: () => baseSession.clearSession(),
    runCompaction: async (args) => {
      if (!compactionEnabled) {
        return null;
      }

      try {
        return await baseSession.runCompaction(args);
      } catch {
        compactionEnabled = false;
        if (!hasNotifiedFailure) {
          hasNotifiedFailure = true;
          onCompactionUnavailable();
        }
        return null;
      }
    },
  };
}

function readDataUrlBase64Payload(dataUrl: string): string {
  const match = /^data:[^,]*,([\s\S]*)$/i.exec(dataUrl.trim());
  if (!match) {
    return "";
  }

  return (match[1] ?? "").replace(/\s+/g, "");
}

function buildAttachmentKey(attachment: ClientAttachment): string {
  return `${attachment.name}\u0000${attachment.sizeBytes}\u0000${attachment.dataUrl}`;
}

function readFileExtension(fileName: string): string {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

function parseAttachmentDataUrl(
  rawDataUrl: unknown,
  pathLabel: string,
): ParseResult<{
  dataUrl: string;
  mimeType: string;
  sizeBytes: number;
}> {
  if (typeof rawDataUrl !== "string") {
    return { ok: false, error: `\`${pathLabel}\` must be a string.` };
  }

  const dataUrl = rawDataUrl.trim();
  if (!dataUrl) {
    return { ok: false, error: `\`${pathLabel}\` is required.` };
  }

  const dataUrlMatch = /^data:([^,]*),([\s\S]*)$/i.exec(dataUrl);
  if (!dataUrlMatch) {
    return {
      ok: false,
      error: `\`${pathLabel}\` must be a valid data URL.`,
    };
  }

  const metadata = (dataUrlMatch[1] ?? "").trim();
  const payload = (dataUrlMatch[2] ?? "").trim();
  if (!payload) {
    return { ok: false, error: `\`${pathLabel}\` must include data.` };
  }

  const metadataParts = metadata
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  const hasBase64 = metadataParts.some((part) => part.toLowerCase() === "base64");
  if (!hasBase64) {
    return {
      ok: false,
      error: `\`${pathLabel}\` must use base64 encoding.`,
    };
  }

  const normalizedBase64 = payload.replace(/\s+/g, "");
  if (
    normalizedBase64.length === 0 ||
    normalizedBase64.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(normalizedBase64)
  ) {
    return {
      ok: false,
      error: `\`${pathLabel}\` contains invalid base64 data.`,
    };
  }

  const sizeBytes = Buffer.from(normalizedBase64, "base64").byteLength;
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
    return {
      ok: false,
      error: `\`${pathLabel}\` is empty.`,
    };
  }

  const rawMimeType = metadataParts[0]?.toLowerCase() ?? "";
  const mimeType = rawMimeType && rawMimeType !== "base64" ? rawMimeType : "";
  return {
    ok: true,
    value: {
      dataUrl,
      mimeType,
      sizeBytes,
    },
  };
}

function createInitialChatMcpRuntimeMetrics(): ChatMcpRuntimeMetrics {
  return {
    mcpConnectedCount: 0,
    mcpReusedCount: 0,
    mcpEphemeralConnectCount: 0,
    mcpConnectDurationMs: 0,
    mcpSetupDurationMs: 0,
  };
}

function applyDefaultThreadDirectoryToStdioServers(
  mcpServers: ClientMcpServerConfig[],
  threadDirectoryPath: string | null,
  userDirectoryPath: string | null,
): ClientMcpServerConfig[] {
  if (!threadDirectoryPath) {
    return mcpServers;
  }

  const normalizedUserDirectoryPath = normalizePathForComparison(userDirectoryPath);
  const dedupeKeys = new Set<string>();
  const normalized: ClientMcpServerConfig[] = [];
  for (const server of mcpServers) {
    let nextServer: ClientMcpServerConfig = server;
    if (server.transport === "stdio") {
      const hasExplicitCwd = typeof server.cwd === "string" && server.cwd.trim().length > 0;
      const isLegacyWorkspaceRootCwd = hasExplicitCwd &&
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
  const server = config.transport === "sse"
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
  const contextHeaders = buildMcpContextRequestHeaders(config, refreshState.requestContext);
  for (const [key, value] of Object.entries(contextHeaders)) {
    headers[key] = value;
  }
  if (config.useAzureAuth) {
    const token = await refreshState.getAzureAuthorizationToken(config.azureAuthScope);
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function fetchWithMcpMetaNormalization(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(input, init);
  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
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
  const normalizedInitializeBody = normalizeMcpInitializeNullOptionals(normalizedMetaBody.value);
  const normalizedToolsBody = normalizeMcpListToolsNullOptionals(normalizedInitializeBody.value);
  if (!normalizedMetaBody.changed && !normalizedInitializeBody.changed && !normalizedToolsBody.changed) {
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

    return changed ? { value: normalizedArray, changed: true } : { value, changed: false };
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

  return changed ? { value: normalizedObject, changed: true } : { value, changed: false };
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

    return changed ? { value: normalizedArray, changed: true } : { value, changed: false };
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

    return changed ? { value: normalizedArray, changed: true } : { value, changed: false };
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

    return changed ? { value: normalizedArray, changed: true } : { value, changed: false };
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

  return changed ? { value: normalizedObject, changed: true } : { value, changed: false };
}

type InstrumentMcpServerHandlers = {
  nextSequence: () => number;
  onRecord: (record: ThreadOperationLogRecord) => void;
};

type InstrumentedMcpServerState = {
  handlers: InstrumentMcpServerHandlers;
  resetListToolsCache: () => void;
};

const instrumentedMcpServerStateSymbol = Symbol("local-playground.instrumented-mcp-server-state");

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
  let cachedListToolsResult: Awaited<ReturnType<typeof originalListTools>> | null = null;
  let pendingListToolsResult:
    | Promise<Awaited<ReturnType<typeof originalListTools>>>
    | null = null;
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

function buildThreadOperationLogRequestId(serverName: string, sequence: number): string {
  const normalizedName = serverName.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-") || "mcp";
  return `${normalizedName}-${Date.now()}-${sequence}`;
}

function buildMcpConnectParams(serverConfig: ClientMcpServerConfig): Record<string, unknown> {
  if (serverConfig.transport === "stdio") {
    return {
      transport: "stdio",
      command: serverConfig.command,
      args: serverConfig.args,
      cwd: serverConfig.cwd ?? "",
      envKeys: Object.keys(serverConfig.env).sort((left, right) => left.localeCompare(right)),
      env: toSerializableValue(serverConfig.env),
    };
  }

  return {
    transport: serverConfig.transport,
    url: serverConfig.url,
    headerKeys: Object.keys(serverConfig.headers).sort((left, right) => left.localeCompare(right)),
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
  const sortedEntries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
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
  if (current.signature === nextSignature && current.errorSignature === nextErrorSignature) {
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

    return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}...` : trimmed;
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
      const serializedNarrowed = JSON.stringify(normalizeObjectKeyOrder(narrowed));
      return normalize(serializedNarrowed ?? "unknown");
    }
  }

  const serialized = JSON.stringify(normalizeObjectKeyOrder(toSerializableValue(value)));
  return normalize(serialized ?? "unknown");
}

function buildRepeatedSkillOperationLoopMessage(options: {
  serverName: string;
  method: string;
  consecutiveCount: number;
}): string {
  return `Detected a repeated Skill operation loop for ${options.serverName}.${options.method} (${options.consecutiveCount} identical consecutive calls). Stopped early to avoid exceeding max turns.`;
}

function buildSkillOperationCountKey(serverName: string, method: string): string {
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

function buildMcpHttpRequestHeaders(headers: Record<string, string>): Record<string, string> {
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
  if (serverConfig.transport === "stdio" || !isLocalPlaygroundMcpContextUrl(serverConfig.url)) {
    return {};
  }

  const contextHeaders: Record<string, string> = {};
  if (requestContext.threadId) {
    contextHeaders[MCP_LOCAL_PLAYGROUND_THREAD_ID_HEADER] = requestContext.threadId;
  }
  if (requestContext.turnId) {
    contextHeaders[MCP_LOCAL_PLAYGROUND_TURN_ID_HEADER] = requestContext.turnId;
  }
  if (requestContext.clientUserAgent) {
    contextHeaders[MCP_LOCAL_PLAYGROUND_CLIENT_USER_AGENT_HEADER] = requestContext.clientUserAgent;
  }
  if (requestContext.clientPlatform) {
    contextHeaders[MCP_LOCAL_PLAYGROUND_CLIENT_PLATFORM_HEADER] = requestContext.clientPlatform;
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

    const normalizedRelativePath = parsedRelativeUrl.pathname.replace(/\/+$/, "");
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
  dependencies: AzureDependencies,
): Promise<string> {
  try {
    return await dependencies.getAzureBearerToken(scope, tenantId);
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

async function buildSkillRuntimeContext(
  selectedSkills: ClientSkillSelection[],
  options: {
    explicitSkillLocations?: string[];
  } = {},
): Promise<SkillRuntimeContext> {
  const warnings: string[] = [];
  if (selectedSkills.length === 0) {
    return {
      activeSkills: [],
      warnings,
    };
  }

  const explicitSkillLocationSet = new Set(
    [
      ...selectedSkills.map((skill) => skill.location),
      ...(options.explicitSkillLocations ?? []),
    ]
      .map((location) => location.trim())
      .filter((location) => location.length > 0),
  );
  const activeSkills: ActiveSkillRuntimeEntry[] = [];
  for (const selectedSkill of selectedSkills) {
    try {
      const frontmatter = await readSkillFrontmatter(selectedSkill.location);
      const shouldPreloadGuide = explicitSkillLocationSet.has(selectedSkill.location);
      let preloadedGuideMarkdown: string | null = null;
      let preloadedGuideErrorMessage: string | null = null;
      if (shouldPreloadGuide) {
        try {
          preloadedGuideMarkdown = await readSkillMarkdown(selectedSkill.location);
        } catch (error) {
          preloadedGuideErrorMessage = readErrorMessage(error);
          warnings.push(`Failed to preload full Skill guide for ${frontmatter.name}: ${preloadedGuideErrorMessage}`);
        }
      }

      const resources = await inspectSkillResourceManifest(selectedSkill.location).catch((error) => {
        warnings.push(
          `Failed to inspect Skill resources for ${frontmatter.name}: ${readErrorMessage(error)}`,
        );
        return buildEmptySkillResourceManifest(selectedSkill.location);
      });

      activeSkills.push({
        name: frontmatter.name,
        description: frontmatter.description,
        location: selectedSkill.location,
        guidePreloadRequested: shouldPreloadGuide,
        preloadedGuideErrorMessage,
        preloadedGuideMarkdown,
        skillRoot: resources.skillRoot,
        scripts: resources.scripts,
        references: resources.references,
        assets: resources.assets,
        scriptsTruncated: resources.scriptsTruncated,
        referencesTruncated: resources.referencesTruncated,
        assetsTruncated: resources.assetsTruncated,
      });
    } catch (error) {
      warnings.push(`Failed to load Skill ${selectedSkill.name}: ${readErrorMessage(error)}`);
    }
  }

  return {
    activeSkills,
    warnings,
  };
}

function buildEmptySkillResourceManifest(skillLocation: string): ReturnType<typeof buildSkillResourceManifestFallback> {
  return buildSkillResourceManifestFallback(path.dirname(skillLocation));
}

function buildSkillResourceManifestFallback(skillRoot: string) {
  return {
    skillRoot,
    scripts: [],
    references: [],
    assets: [],
    scriptsTruncated: false,
    referencesTruncated: false,
    assetsTruncated: false,
  };
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
  ): { ok: true; skills: ActiveSkillRuntimeEntry[] } | { ok: false; error: string } => {
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
        error: "Multiple Skills are active. Provide `skill` by name or location.",
      };
    }

    const byLocation = activeSkills.find((skill) => skill.location === selector);
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

  const readSkillOperationParams = (input: unknown): Record<string, unknown> => {
    const threadEnvironment = cloneThreadEnvironment(executionContext.threadEnvironment);
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
  const skillOperationCachedResultBySignature = new Map<string, SkillOperationCachedResult>();

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
    const errorSignature = buildSkillOperationErrorSignature(options.errorPayload);
    skillOperationErrorLoopState = updateSkillOperationErrorLoopState(
      skillOperationErrorLoopState,
      options.operationSignature,
      errorSignature,
    );
    const operationSignatureCallLimit = readSkillOperationSignatureCallLimit(options.method);
    if (skillOperationErrorLoopState.consecutiveCount > operationSignatureCallLimit) {
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
      const operationCountErrorMessage = buildSkillOperationCountExceededMessage({
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
      skillOperationLoopState.consecutiveCount > CHAT_MAX_CONSECUTIVE_IDENTICAL_SKILL_OPERATIONS
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

    const cachedResult = skillOperationCachedResultBySignature.get(operationSignature);
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
          description: "Optional active Skill name or location. Required when multiple Skills are active.",
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
        if ((startLine !== null && startLine <= 0) || (endLine !== null && endLine <= 0)) {
          return buildSkillToolErrorResult("startLine and endLine must be positive integers.");
        }
        if (startLine !== null && endLine !== null && endLine < startLine) {
          return buildSkillToolErrorResult("endLine must be greater than or equal to startLine.");
        }

        const maxChars = normalizeSkillReadMaxChars(input.maxChars);
        const lineNormalized = content.replace(/\r\n?/g, "\n");
        const lines = lineNormalized.split("\n");
        const begin = Math.max(1, startLine ?? 1);
        const end = Math.min(lines.length, endLine ?? lines.length);
        const lineWindowText =
          lines.length === 0 || end < begin ? "" : lines.slice(begin - 1, end).join("\n");
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
          description: "Optional active Skill name or location. Required when multiple Skills are active.",
        },
        path: {
          type: "string" as const,
          description: "Relative file path inside the selected Skill's references directory.",
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
        if ((startLine !== null && startLine <= 0) || (endLine !== null && endLine <= 0)) {
          return buildSkillToolErrorResult("startLine and endLine must be positive integers.");
        }
        if (startLine !== null && endLine !== null && endLine < startLine) {
          return buildSkillToolErrorResult("endLine must be greater than or equal to startLine.");
        }

        const maxChars = normalizeSkillReadMaxChars(input.maxChars);
        const lineNormalized = content.replace(/\r\n?/g, "\n");
        const lines = lineNormalized.split("\n");
        const begin = Math.max(1, startLine ?? 1);
        const end = Math.min(lines.length, endLine ?? lines.length);
        const lineWindowText =
          lines.length === 0 || end < begin ? "" : lines.slice(begin - 1, end).join("\n");
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
          description: "Optional active Skill name or location. Required when multiple Skills are active.",
        },
        path: {
          type: "string" as const,
          description: "Relative file path inside the selected Skill's assets directory.",
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
          encoding === "base64" ? buffer.toString("base64") : buffer.toString("utf8");
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
          description: "Optional active Skill name or location. Required when multiple Skills are active.",
        },
        path: {
          type: "string" as const,
          description: "Relative script path inside the selected Skill's scripts directory.",
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
    description: "Read thread-scoped environment variables shared across turns.",
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
          description:
            `Optional environment key-value map. Keys must match ${ENV_KEY_PATTERN.toString()} and be ${THREAD_ENVIRONMENT_KEY_MAX_LENGTH} characters or fewer.`,
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

        const variablesResult = parseThreadEnvironmentFromUnknown(input.variables, {
          strict: true,
          pathLabel: "variables",
        });
        if (!variablesResult.ok) {
          return buildSkillToolErrorResult(variablesResult.error);
        }

        const unsetResult = readUnsetThreadEnvironmentKeys(input.unset);
        if (!unsetResult.ok) {
          return buildSkillToolErrorResult(unsetResult.error);
        }

        const nextKeys = new Set(Object.keys(executionContext.threadEnvironment));
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

function collectSkillRuntimeWarnings(runtime: SkillRuntimeContext): string[] {
  return runtime.warnings
    .map((warning) => warning.trim())
    .filter((warning) => warning.length > 0);
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
        preloadMode: skill.guidePreloadRequested ? "full_guide" : "frontmatter_only",
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
  const clipped = clipTextForSkillTool(lineNormalized, AGENT_SKILL_READ_TEXT_DEFAULT_MAX_CHARS);

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

function buildAgentInstructionWithSkills(
  baseInstruction: string,
  runtime: SkillRuntimeContext,
  options: {
    instructionContextToggles: ThreadInstructionContextToggles;
    systemInstructionContext: SystemInstructionContextPayload | null;
  },
): string {
  const normalizedBaseInstruction = baseInstruction.trim() || DEFAULT_AGENT_INSTRUCTION;
  const lines: string[] = [normalizedBaseInstruction];

  if (options.instructionContextToggles.system && options.systemInstructionContext) {
    lines.push(
      "",
      "<implicit_instruction_contexts>",
      "The following context is injected by Local Playground at runtime.",
      "Treat these identifiers and runtime values as authoritative. Reuse values directly and do not guess missing values.",
      '<context name="system">',
      "```json",
      JSON.stringify(options.systemInstructionContext, null, 2),
      "```",
      "</context>",
      "</implicit_instruction_contexts>",
    );
  }

  if (runtime.activeSkills.length === 0) {
    return lines.join("\n");
  }

  const preloadedGuideSkillCount = runtime.activeSkills.filter(
    (skill) => skill.preloadedGuideMarkdown !== null,
  ).length;
  lines.push(
    "",
    "<skills_context>",
    "The runtime supports agentskills-compatible Skill directories (SKILL.md + scripts/references/assets). Some skills may also define non-standard directories like resources/.",
    preloadedGuideSkillCount > 0
      ? "Linked Skills in this turn are initialized in order with skill/activate then skill_read_guide before model execution."
      : "Active skills are preloaded with frontmatter only (name + description).",
    "skill_read_guide is already executed once for linked Skills. Call it again only when a specific line range is needed.",
    "Use skill_list_resources before reading/running files when paths are unknown.",
    "Use skill_get_environment and skill_set_environment to inspect and update thread-scoped environment variables that persist across turns.",
    "skill_run_script runs with the current thread-scoped environment variables.",
    "Follow each SKILL.md guide and use the needed paths from skill_list_resources with skill_read_guide, skill_read_reference, skill_read_asset, and skill_run_script.",
  );

  if (preloadedGuideSkillCount > 0 && preloadedGuideSkillCount < runtime.activeSkills.length) {
    lines.push("Other active skills are preloaded with frontmatter only (name + description).");
  }
  lines.push("<active_skills>");
  for (const skill of runtime.activeSkills) {
    lines.push(`<<<ACTIVE_SKILL_FRONTMATTER name="${skill.name}" location="${skill.location}">>>`);
    lines.push(`description: ${truncateSkillDescription(skill.description)}`);
    lines.push("<<<END_ACTIVE_SKILL_FRONTMATTER>>>");
    if (skill.preloadedGuideMarkdown !== null) {
      lines.push(`<<<ACTIVE_SKILL_GUIDE name="${skill.name}" location="${skill.location}">>>`);
      lines.push(skill.preloadedGuideMarkdown);
      lines.push("<<<END_ACTIVE_SKILL_GUIDE>>>");
    }
    lines.push(
      ...buildSkillPromptResourcePreview({
        heading: "scripts",
        files: skill.scripts,
        truncated: skill.scriptsTruncated,
      }),
    );
    lines.push(
      ...buildSkillPromptResourcePreview({
        heading: "references",
        files: skill.references,
        truncated: skill.referencesTruncated,
      }),
    );
    lines.push(
      ...buildSkillPromptResourcePreview({
        heading: "assets",
        files: skill.assets,
        truncated: skill.assetsTruncated,
      }),
    );
  }
  lines.push("</active_skills>");
  lines.push(
    "Follow active skills as additional instructions. If skills conflict, the most specific active skill should win unless it violates system safety.",
  );

  lines.push("</skills_context>");
  return lines.join("\n");
}

async function buildSystemInstructionContextPayload(
  options: ChatExecutionOptions,
): Promise<SystemInstructionContextPayload> {
  const clientOperatingSystem = buildInstructionClientOperatingSystemContext(
    options.clientPlatform,
    options.clientUserAgent,
  );
  const serverOperatingSystem = buildInstructionServerOperatingSystemContext();
  const basePayload: SystemInstructionContextPayload = {
    userContext: {
      userId: null,
      workspaceDirectoryPath: null,
    },
    threadContext: {
      threadId: options.threadId,
      turnId: options.turnId,
    },
    systemContext: {
      clientOperatingSystem,
      serverOperatingSystem,
    },
    latestThreadName: null,
    azureContext: {
      principalDisplayName: null,
      principalName: null,
      principalType: "Unknown",
      tenantId: normalizeOptionalInstructionLabel(options.azureConfig.tenantId),
      principalId: null,
      playgroundProject: normalizeOptionalInstructionLabel(options.azureConfig.projectName),
      playgroundProjectId: null,
      playgroundDeployment: normalizeOptionalInstructionLabel(options.azureConfig.deploymentName),
      endpoint: normalizeOptionalInstructionLabel(options.azureConfig.baseUrl),
      apiVersion: normalizeOptionalInstructionLabel(options.azureConfig.apiVersion),
    },
  };

  const azureContext = await readAzureArmUserContext(undefined, options.azureConfig.tenantId);
  if (!azureContext) {
    return basePayload;
  }

  const payload: SystemInstructionContextPayload = {
    ...basePayload,
    azureContext: {
      ...basePayload.azureContext,
      principalDisplayName: normalizeOptionalInstructionLabel(azureContext.displayName),
      principalName: normalizeOptionalInstructionLabel(azureContext.principalName),
      principalType: formatInstructionPrincipalType(azureContext.principalType),
      tenantId: normalizeOptionalInstructionLabel(azureContext.tenantId),
      principalId: normalizeOptionalInstructionLabel(azureContext.principalId),
    },
  };

  try {
    const userId = options.userId;
    if (userId === null) {
      return payload;
    }

    payload.userContext = {
      userId,
      workspaceDirectoryPath: resolveThreadDirectoryPath({
        userId,
        threadId: options.threadId,
      }),
    };

    await ensurePersistenceDatabaseReady();
    const [latestThreadName, selection] = await Promise.all([
      readLatestThreadNameForInstruction(userId),
      readPlaygroundSelectionForInstruction(userId),
    ]);
    payload.latestThreadName = latestThreadName;
    payload.azureContext = {
      ...payload.azureContext,
      playgroundProjectId: selection.projectId,
      playgroundDeployment:
        payload.azureContext.playgroundDeployment ?? selection.deploymentName,
    };
  } catch {
    // Best-effort enrichment only; chat execution should not fail when this metadata is unavailable.
  }

  return payload;
}

function resolveThreadDirectoryPath(options: {
  userId: number;
  threadId: string | null;
}): string | null {
  if (!options.threadId) {
    return null;
  }

  try {
    return resolveFoundryWorkspaceThreadDirectory({
      workspaceUserId: options.userId,
      threadId: options.threadId,
    });
  } catch {
    return null;
  }
}

async function resolveThreadDirectoryContext(options: {
  threadId: string | null;
  tenantId: string;
}): Promise<{
  userId: number;
  userDirectoryPath: string;
  threadDirectoryPath: string | null;
} | null> {
  try {
    const azureContext = await readAzureArmUserContext(undefined, options.tenantId);
    if (!azureContext) {
      return null;
    }

    const user = await getOrCreateUserByIdentity({
      tenantId: azureContext.tenantId,
      principalId: azureContext.principalId,
    });
    return {
      userId: user.id,
      userDirectoryPath: resolveFoundryWorkspaceUserDirectory({
        workspaceUserId: user.id,
      }),
      threadDirectoryPath: resolveThreadDirectoryPath({
        userId: user.id,
        threadId: options.threadId,
      }),
    };
  } catch {
    return null;
  }
}

function normalizePathForComparison(value: string | null | undefined): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replaceAll("\\", "/").toLowerCase();
}

async function readLatestThreadNameForInstruction(userId: number): Promise<string | null> {
  const latestThread = await prisma.thread.findFirst({
    where: {
      userId,
      deletedAt: null,
    },
    orderBy: [
      { updatedAt: "desc" },
    ],
    select: {
      name: true,
    },
  });

  return normalizeOptionalInstructionLabel(latestThread?.name);
}

async function readPlaygroundSelectionForInstruction(userId: number): Promise<{
  projectId: string | null;
  deploymentName: string | null;
}> {
  const selection = await prisma.azureSelectionPreference.findUnique({
    where: {
      userId,
    },
    select: {
      projectId: true,
      deploymentName: true,
    },
  });

  return {
    projectId: normalizeOptionalInstructionLabel(selection?.projectId),
    deploymentName: normalizeOptionalInstructionLabel(selection?.deploymentName),
  };
}

function normalizeOptionalInstructionLabel(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function formatInstructionPrincipalType(
  principalType: AzurePrincipalType,
): "User" | "Service Principal" | "Managed Identity" | "Unknown" {
  if (principalType === "user") {
    return "User";
  }
  if (principalType === "servicePrincipal") {
    return "Service Principal";
  }
  if (principalType === "managedIdentity") {
    return "Managed Identity";
  }
  return "Unknown";
}

function buildInstructionClientOperatingSystemContext(
  clientPlatform: string | null,
  clientUserAgent: string | null,
): InstructionClientOperatingSystemContext {
  const normalizedPlatform = normalizeOptionalInstructionLabel(clientPlatform);
  if (normalizedPlatform) {
    return {
      name: normalizeInstructionClientHintPlatform(normalizedPlatform),
      version: null,
      source: "sec-ch-ua-platform",
    };
  }

  const normalizedUserAgent = normalizeOptionalInstructionLabel(clientUserAgent);
  if (!normalizedUserAgent) {
    return {
      name: "Unknown",
      version: null,
      source: "unknown",
    };
  }

  const parsedFromUserAgent = parseInstructionOperatingSystemFromUserAgent(
    normalizedUserAgent,
  );
  if (!parsedFromUserAgent) {
    return {
      name: "Unknown",
      version: null,
      source: "unknown",
    };
  }

  return {
    ...parsedFromUserAgent,
    source: "user-agent",
  };
}

function parseInstructionOperatingSystemFromUserAgent(
  userAgent: string,
): Omit<InstructionClientOperatingSystemContext, "source"> | null {
  const lowerUserAgent = userAgent.toLowerCase();

  if (lowerUserAgent.includes("windows nt")) {
    return {
      name: "Windows",
      version: normalizeInstructionOperatingSystemVersion(
        extractInstructionUserAgentVersion(userAgent, /Windows NT ([0-9.]+)/i),
      ),
    };
  }

  if (/iphone|ipad|ipod/i.test(userAgent)) {
    return {
      name: "iOS",
      version: normalizeInstructionOperatingSystemVersion(
        extractInstructionUserAgentVersion(userAgent, /OS ([0-9_]+)/i),
      ),
    };
  }

  if (lowerUserAgent.includes("android")) {
    return {
      name: "Android",
      version: normalizeInstructionOperatingSystemVersion(
        extractInstructionUserAgentVersion(userAgent, /Android ([0-9.]+)/i),
      ),
    };
  }

  if (lowerUserAgent.includes("mac os x") || lowerUserAgent.includes("macintosh")) {
    return {
      name: "macOS",
      version: normalizeInstructionOperatingSystemVersion(
        extractInstructionUserAgentVersion(userAgent, /Mac OS X ([0-9_]+)/i),
      ),
    };
  }

  if (lowerUserAgent.includes("linux")) {
    return {
      name: "Linux",
      version: null,
    };
  }

  return null;
}

function extractInstructionUserAgentVersion(
  userAgent: string,
  pattern: RegExp,
): string | null {
  const matched = userAgent.match(pattern);
  const version = matched?.[1];
  if (typeof version !== "string") {
    return null;
  }

  const normalized = version.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeInstructionOperatingSystemVersion(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return value.replaceAll("_", ".");
}

function normalizeInstructionClientHintPlatform(value: string): string {
  const unquoted = value.trim().replace(/^"(.*)"$/, "$1").trim();
  return unquoted.length > 0 ? unquoted : "Unknown";
}

function buildInstructionServerOperatingSystemContext(): InstructionServerOperatingSystemContext {
  const platform = process.platform;
  return {
    name: mapInstructionNodePlatformToOperatingSystemName(platform),
    platform,
    release: nodeOs.release(),
    architecture: nodeOs.arch(),
  };
}

function mapInstructionNodePlatformToOperatingSystemName(platform: NodeJS.Platform): string {
  if (platform === "darwin") {
    return "macOS";
  }
  if (platform === "win32") {
    return "Windows";
  }
  if (platform === "linux") {
    return "Linux";
  }
  return platform;
}

function truncateSkillDescription(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length <= 220) {
    return normalized;
  }

  return `${normalized.slice(0, 217)}...`;
}

function buildSkillPromptResourcePreview(options: {
  heading: "scripts" | "references" | "assets";
  files: SkillResourceFileEntry[];
  truncated: boolean;
}): string[] {
  const lines: string[] = [`<${options.heading}>`];
  if (options.files.length === 0) {
    lines.push("- (none)");
    lines.push(`</${options.heading}>`);
    return lines;
  }

  const previewFiles = options.files.slice(0, AGENT_SKILL_PROMPT_RESOURCE_PREVIEW_MAX_FILES);
  for (const entry of previewFiles) {
    lines.push(`- ${entry.path} (${entry.sizeBytes} bytes)`);
  }
  if (options.truncated || options.files.length > previewFiles.length) {
    const omitted = options.truncated
      ? Math.max(1, options.files.length - previewFiles.length)
      : Math.max(0, options.files.length - previewFiles.length);
    lines.push(`- ...and ${omitted} more files.`);
  }
  lines.push(`</${options.heading}>`);
  return lines;
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
    const previewEntries = sourceEntries.slice(0, AGENT_SKILL_TOOL_RESOURCE_PREVIEW_MAX_FILES);
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
  return value === "scripts" || value === "references" || value === "assets" ? value : null;
}

function readInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isSafeInteger(value)) {
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

function buildSkillScriptEnvironment(threadEnvironment: ThreadEnvironment): Record<string, string> {
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
    if (!alreadyExists && threadEnvironmentEntryCount >= THREAD_ENVIRONMENT_VARIABLES_MAX) {
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
  return value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_match, variableName: string) => {
    const threadValue = environment[variableName];
    if (typeof threadValue === "string") {
      return threadValue;
    }

    const processValue = process.env[variableName];
    return typeof processValue === "string" ? processValue : "";
  });
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

    const toolName = knownToolName || readToolNameFromRunItem(item) || shortenToolCallId(callId);
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

  const output = "output" in item ? item.output : isRecord(item.rawItem) ? item.rawItem.output : null;
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
      typeof parsedValue.exitCode === "number" && Number.isFinite(parsedValue.exitCode)
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

async function awaitWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function runAgentWithTimeout<T>(
  runTask: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
  upstreamAbortSignal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const removeAbortRelay = relayAbortSignal(upstreamAbortSignal, controller);
  try {
    return await awaitWithTimeout(runTask(controller.signal), timeoutMs, timeoutMessage);
  } catch (error) {
    controller.abort();
    throw error;
  } finally {
    removeAbortRelay();
  }
}

function relayAbortSignal(
  source: AbortSignal | undefined,
  target: AbortController,
): () => void {
  if (!source) {
    return () => {};
  }

  if (source.aborted) {
    target.abort();
    return () => {};
  }

  const onAbort = () => {
    target.abort();
  };
  source.addEventListener("abort", onAbort);
  return () => {
    source.removeEventListener("abort", onAbort);
  };
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal || !signal.aborted) {
    return;
  }

  throw new RequestCanceledError();
}

function buildUpstreamErrorPayload(error: unknown, deploymentName: string): {
  payload: UpstreamErrorPayload;
  status: number;
} {
  if (isRequestCanceledError(error)) {
    return {
      payload: {
        code: "request_canceled",
        error: "Request was canceled by client disconnect.",
      },
      status: 499,
    };
  }

  if (isAzureCredentialError(error)) {
    return {
      payload: {
        code: "auth_required",
        error:
          "Azure authentication failed. Click \"Azure Login\", complete sign-in, and try again.",
        errorCode: "azure_login_required",
      },
      status: 401,
    };
  }

  const message = buildUpstreamErrorMessage(error, deploymentName);
  return {
    payload: { code: "upstream_service_error", error: message },
    status: 502,
  };
}

function isRequestCanceledError(error: unknown): boolean {
  if (error instanceof RequestCanceledError) {
    return true;
  }

  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.message === "Request was canceled.")
  );
}

function buildUpstreamErrorMessage(error: unknown, deploymentName: string): string {
  if (!(error instanceof Error)) {
    return "Could not connect to Azure OpenAI.";
  }

  if (isTransientNetworkTerminationError(error)) {
    return "Connection to Azure OpenAI was interrupted before completion. Please retry.";
  }
  if (error.message.includes("Resource not found")) {
    return `${error.message} Check Azure base URL and deployment name (${deploymentName}).`;
  }
  if (error.message.includes("Unavailable model")) {
    return `${error.message} Check the selected deployment name (${deploymentName}).`;
  }
  if (error.message.includes("Model behavior error")) {
    return `${error.message} Verify your model/deployment supports the selected reasoning effort.`;
  }
  if (error.message.includes("repeated Skill operation loop")) {
    return `${error.message} Review active Skills or reduce repeated Skill tool calls, then retry.`;
  }
  if (error.message.includes("excessive Skill operation usage")) {
    return `${error.message} Review active Skills or simplify the workflow, then retry.`;
  }
  if (error.message.includes("too many Skill operation errors")) {
    return `${error.message} Fix failing Skill scripts or reduce unstable steps, then retry.`;
  }
  if (error.message.includes("Max turns (")) {
    return `${error.message} Try reducing active MCP servers or skills, or retry the request.`;
  }

  return error.message;
}

function isTransientNetworkTerminationError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const normalizedMessage = error.message.trim().toLowerCase();
  if (normalizedMessage === "terminated" || normalizedMessage.includes("socket closed")) {
    return true;
  }

  const causeCode =
    typeof (error as { cause?: unknown }).cause === "object" &&
    (error as { cause?: { code?: unknown } }).cause !== null
      ? (error as { cause: { code?: unknown } }).cause.code
      : null;
  if (typeof causeCode !== "string") {
    return false;
  }

  const normalizedCauseCode = causeCode.toUpperCase();
  return (
    normalizedCauseCode === "UND_ERR_SOCKET" ||
    normalizedCauseCode === "UND_ERR_ABORTED" ||
    normalizedCauseCode === "ECONNRESET" ||
    normalizedCauseCode === "EPIPE"
  );
}

function shouldRetryChatExecution(
  error: unknown,
  attempt: number,
  maxAttempts: number,
): boolean {
  if (attempt >= maxAttempts) {
    return false;
  }

  return isTransientNetworkTerminationError(error);
}

function isAzureCredentialError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return [
    "defaultazurecredential",
    "interactivebrowsercredential",
    "authenticationrequirederror",
    "automatic authentication has been disabled",
    "chainedtokencredential",
    "credentialunavailableerror",
    "managedidentitycredential",
    "azure credential failed",
    "azure credential returned tenant",
    "requested tenant",
    "token without tid claim",
  ].some((pattern) => message.includes(pattern));
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error.";
}

function sleep(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
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
  hasNonPdfAttachments,
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
  runAgentWithTimeout,
  throwIfAborted,
  RequestCanceledError,
  resolveThreadDirectoryPath,
  applyDefaultThreadDirectoryToStdioServers,
};
