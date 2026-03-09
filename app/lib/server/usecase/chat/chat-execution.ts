import {
  Agent,
  assistant,
  run,
  user,
  type AgentInputItem,
  type MCPServer,
  type OpenAIResponsesCompactionAwareSession,
  type Tool,
} from "@openai/agents";
import {
  OpenAIResponsesCompactionSession,
  OpenAIResponsesModel,
  codeInterpreterTool,
} from "@openai/agents-openai";
import { toFile } from "openai";
import {
  CHAT_CLEANUP_TIMEOUT_MS,
  CHAT_CODE_INTERPRETER_UPLOAD_TIMEOUT_MS,
  CHAT_MAX_RUN_TURNS,
  CHAT_MODEL_RUN_TIMEOUT_MS,
  CODE_INTERPRETER_ATTACHMENT_AVAILABILITY_CACHE_MS,
} from "~/lib/constants/chat";
import { THREAD_MCP_SERVER_SESSION_IDLE_TTL_MS } from "~/lib/constants/mcp";
import type { ReasoningEffort } from "~/lib/domain/shared/reasoning-effort";
import {
  cloneThreadEnvironment,
  type ThreadEnvironment,
} from "~/lib/contracts/threads/environment";
import type { ThreadInstructionContextToggles } from "~/lib/contracts/threads/instruction-context";
import type {
  ClientAttachment,
  ClientMcpServerConfig,
  ClientMessage,
  ClientSkillSelection,
  ResolvedAzureConfig,
} from "~/lib/server/chat/request-parser";
import type { WebSearchPreviewUserLocation } from "~/lib/server/chat/request-metadata";
import type {
  SkillResourceFileEntry,
} from "~/lib/server/skills/runtime";
import type { AzureOpenAIClient } from "~/lib/server/usecase/azure/azure-openai-service";

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const chatTransientTerminationRetryMaxAttempts = 2;
const chatTransientTerminationRetryDelayMs = 250;
const WEB_SEARCH_PREVIEW_TOOL_NAME = "web_search_preview";
const WEB_SEARCH_PREVIEW_CONTEXT_SIZE = "medium";

export type UpstreamErrorPayload = {
  code: string;
  error: string;
  errorCode?: "azure_login_required";
};

export type ChatExecutionOptions = {
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

export type JsonRpcRequestPayload = {
  jsonrpc: "2.0";
  id: string;
  method: string;
  params: Record<string, unknown>;
};

export type JsonRpcResponsePayload =
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

export type ThreadOperationLogRecord = {
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

export type ChatExecutionEvent =
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

export type McpRequestContext = {
  threadId: string | null;
  turnId: string | null;
  clientUserAgent: string | null;
  clientPlatform: string | null;
};

export type ChatMcpRuntimeMetrics = {
  mcpConnectedCount: number;
  mcpReusedCount: number;
  mcpEphemeralConnectCount: number;
  mcpConnectDurationMs: number;
  mcpSetupDurationMs: number;
};

export type McpServerSessionRefreshState = {
  requestContext: McpRequestContext;
  getAzureAuthorizationToken: (scope: string) => Promise<string>;
  logHandlers: {
    nextSequence: () => number;
    onRecord: (record: ThreadOperationLogRecord) => void;
  };
};

export type ChatExecutionResult = {
  message: string;
  threadEnvironment: ThreadEnvironment;
  operationLogCount: number;
  mcpRuntimeMetrics: ChatMcpRuntimeMetrics;
};

export type CodeInterpreterAttachmentAvailabilityCache = {
  supported: boolean;
  checkedAt: number;
  reason: string;
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

export type InstructionSystemContextPayload = {
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
    principalType:
      | "User"
      | "Service Principal"
      | "Managed Identity"
      | "Unknown";
    tenantId: string | null;
    principalId: string | null;
    playgroundProject: string | null;
    playgroundProjectId: string | null;
    playgroundDeployment: string | null;
    endpoint: string | null;
    apiVersion: string | null;
  };
};

export type ActiveSkillRuntimeEntry = {
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

export type SkillRuntimeContext = {
  activeSkills: ActiveSkillRuntimeEntry[];
  warnings: string[];
};

export type SkillToolExecutionContext = {
  threadEnvironment: ThreadEnvironment;
};

export type ThreadMcpServerSessionLeaseLike = {
  server: MCPServer;
  status: "connected" | "reused";
  isEphemeral: boolean;
  release: () => Promise<void>;
};

export type ThreadMcpServerSessionLike<TRefreshState> = {
  server: MCPServer;
  refreshBeforeUse: (refreshState: TRefreshState) => Promise<void>;
};

export type ChatExecutionDependencies = {
  createAzureOpenAIClient: (
    baseUrl: string,
    tenantId: string,
  ) => AzureOpenAIClient;
  prepareMcpRuntime: (options: {
    serverConfigs: ClientMcpServerConfig[];
    connectServer: (
      serverConfig: ClientMcpServerConfig,
    ) => Promise<{
      lease: ThreadMcpServerSessionLeaseLike;
      server: MCPServer;
      connectDurationMs: number;
    }>;
    releaseLease: (
      lease: ThreadMcpServerSessionLeaseLike,
    ) => Promise<void>;
  }) => Promise<{
    leases: ThreadMcpServerSessionLeaseLike[];
    servers: MCPServer[];
    metrics: ChatMcpRuntimeMetrics;
  }>;
  acquireThreadMcpServerSession: (options: {
    threadId: string | null;
    sessionKey: string;
    refreshState: McpServerSessionRefreshState;
    idleTtlMs: number;
    createSession: () => Promise<
      ThreadMcpServerSessionLike<McpServerSessionRefreshState>
    >;
  }) => Promise<ThreadMcpServerSessionLeaseLike>;
  buildThreadOperationLogRequestId: (
    serverName: string,
    sequence: number,
  ) => string;
  buildMcpConnectParams: (
    serverConfig: ClientMcpServerConfig,
  ) => Record<string, unknown>;
  buildMcpServerSessionConfigKey: (
    config: ClientMcpServerConfig,
  ) => string;
  getAzureMcpAuthorizationToken: (
    scope: string,
    tenantId: string,
  ) => Promise<string>;
  createMcpServerSession: (
    config: ClientMcpServerConfig,
  ) => Promise<ThreadMcpServerSessionLike<McpServerSessionRefreshState>>;
  buildMcpConnectSuccessResponse: (
    requestId: string,
    status: "connected" | "reused",
  ) => JsonRpcResponsePayload;
  describeMcpServer: (config: ClientMcpServerConfig) => string;
  prepareSkillRuntime: (options: {
    loadRuntime: () => Promise<SkillRuntimeContext>;
    createExecutionContext: (
      runtime: SkillRuntimeContext,
    ) => SkillToolExecutionContext | null;
    emitActivationLogs: (
      runtime: SkillRuntimeContext,
      context: SkillToolExecutionContext,
    ) => void;
    collectWarnings: (runtime: SkillRuntimeContext) => string[];
  }) => Promise<{
    runtime: SkillRuntimeContext;
    executionContext: SkillToolExecutionContext | null;
    warnings: string[];
  }>;
  buildSkillRuntimeContext: (
    selectedSkills: ClientSkillSelection[],
    options: {
      explicitSkillLocations?: string[];
    },
  ) => Promise<SkillRuntimeContext>;
  emitSkillActivationOperationLogs: (
    skillRuntime: SkillRuntimeContext,
    logHandlers: {
      nextSequence: () => number;
      onRecord: (record: ThreadOperationLogRecord) => void;
    },
    skillExecutionContext: SkillToolExecutionContext,
  ) => void;
  collectSkillRuntimeWarnings: (
    skillRuntime: SkillRuntimeContext,
  ) => string[];
  buildSystemInstructionContextPayload: (
    options: ChatExecutionOptions,
  ) => Promise<InstructionSystemContextPayload | null>;
  buildSkillTools: (
    activeSkills: ActiveSkillRuntimeEntry[],
    logHandlers: {
      nextSequence: () => number;
      onRecord: (record: ThreadOperationLogRecord) => void;
    },
    executionContext: SkillToolExecutionContext,
  ) => Tool<unknown>[];
  buildAgentInstructionWithSkills: (
    agentInstruction: string,
    skillRuntime: SkillRuntimeContext,
    options: {
      instructionContextToggles: ThreadInstructionContextToggles;
      systemInstructionContext: InstructionSystemContextPayload | null;
    },
  ) => string;
  buildAgentRunContext: <TInput>(options: {
    historyInput: TInput[];
    currentInput: TInput;
    compactionSession: unknown | null;
  }) => { runInput: TInput[] };
  readProgressEventFromRunStreamEvent: (
    event: unknown,
    hasMcpServers: boolean,
    toolNameByCallId: Map<string, string>,
  ) => ChatProgressEvent | null;
  cleanupChatRuntime: (options: {
    codeInterpreterContainerId: string;
    deleteCodeInterpreterContainer: (containerId: string) => Promise<void>;
    mcpServerLeases: ThreadMcpServerSessionLeaseLike[];
    awaitWithTimeout: <T>(
      promise: Promise<T>,
      timeoutMs: number,
      timeoutMessage: string,
    ) => Promise<T>;
    cleanupTimeoutMs: number;
  }) => Promise<void>;
};

export class RequestCanceledError extends Error {
  constructor(message = "Request was canceled.") {
    super(message);
    this.name = "RequestCanceledError";
  }
}

let codeInterpreterAttachmentAvailabilityCache: CodeInterpreterAttachmentAvailabilityCache | null =
  null;

export async function executeChat(
  options: ChatExecutionOptions,
  dependencies: ChatExecutionDependencies,
  onEvent?: (event: ChatExecutionEvent) => void,
  abortSignal?: AbortSignal,
): Promise<ChatExecutionResult> {
  throwIfAborted(abortSignal);
  const azureOpenAIClient = dependencies.createAzureOpenAIClient(
    options.azureConfig.baseUrl,
    options.azureConfig.tenantId,
  );
  const connectedMcpServers: MCPServer[] = [];
  const connectedMcpServerLeases: ThreadMcpServerSessionLeaseLike[] = [];
  let codeInterpreterContainerId = "";
  const toolNameByCallId = new Map<string, string>();
  let operationLogSequence = 0;
  const hasMcpServers = options.mcpServers.length > 0;
  const azureMcpAuthorizationTokenPromiseByScope = new Map<
    string,
    Promise<string>
  >();
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

    const mcpRuntime = await dependencies.prepareMcpRuntime({
      serverConfigs: options.mcpServers,
      connectServer: async (serverConfig) => {
        emitProgress({
          message: `Connecting MCP server: ${serverConfig.name}`,
          isMcp: true,
        });

        const connectSequence = nextThreadOperationLogSequence();
        const connectRequestId =
          dependencies.buildThreadOperationLogRequestId(
            serverConfig.name,
            connectSequence,
          );
        const connectStartedAtMs = Date.now();
        const connectStartedAt = new Date(connectStartedAtMs).toISOString();
        const connectRequest: JsonRpcRequestPayload = {
          jsonrpc: "2.0",
          id: connectRequestId,
          method: "server/connect",
          params: dependencies.buildMcpConnectParams(serverConfig),
        };

        try {
          const lease = await dependencies.acquireThreadMcpServerSession({
            threadId: options.threadId,
            sessionKey: dependencies.buildMcpServerSessionConfigKey(
              serverConfig,
            ),
            refreshState: {
              requestContext: mcpRequestContext,
              getAzureAuthorizationToken: (scope) => {
                const normalizedScope = scope.trim();
                const current =
                  azureMcpAuthorizationTokenPromiseByScope.get(normalizedScope);
                if (current) {
                  return current;
                }

                const created = dependencies.getAzureMcpAuthorizationToken(
                  normalizedScope,
                  options.azureConfig.tenantId,
                );
                azureMcpAuthorizationTokenPromiseByScope.set(
                  normalizedScope,
                  created,
                );
                return created;
              },
              logHandlers: {
                nextSequence: nextThreadOperationLogSequence,
                onRecord: emitThreadOperationLogRecord,
              },
            },
            idleTtlMs: THREAD_MCP_SERVER_SESSION_IDLE_TTL_MS,
            createSession: async () =>
              dependencies.createMcpServerSession(serverConfig),
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
            response: dependencies.buildMcpConnectSuccessResponse(
              connectRequestId,
              lease.status,
            ),
            isError: false,
          });
          emitProgress({
            message:
              lease.status === "reused"
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
            `Failed to connect MCP server "${serverConfig.name}" (${dependencies.describeMcpServer(serverConfig)}): ${readErrorMessage(error)}`,
          );
        }
      },
      releaseLease: async (lease) => lease.release(),
    });
    connectedMcpServerLeases.push(...mcpRuntime.leases);
    connectedMcpServers.push(...mcpRuntime.servers);
    Object.assign(mcpRuntimeMetrics, mcpRuntime.metrics);

    const preparedSkillRuntime = await dependencies.prepareSkillRuntime({
      loadRuntime: async () =>
        dependencies.buildSkillRuntimeContext(options.skills, {
          explicitSkillLocations: options.explicitSkillLocations,
        }),
      createExecutionContext: (skillRuntime) =>
        skillRuntime.activeSkills.length > 0
          ? {
              threadEnvironment: cloneThreadEnvironment(
                options.threadEnvironment,
              ),
            }
          : null,
      emitActivationLogs: (skillRuntime, skillExecutionContext) => {
        dependencies.emitSkillActivationOperationLogs(
          skillRuntime,
          {
            nextSequence: nextThreadOperationLogSequence,
            onRecord: emitThreadOperationLogRecord,
          },
          skillExecutionContext,
        );
      },
      collectWarnings: (skillRuntime) =>
        dependencies.collectSkillRuntimeWarnings(skillRuntime),
    });
    const skillRuntime = preparedSkillRuntime.runtime;
    const skillExecutionContext = preparedSkillRuntime.executionContext;
    const skillWarnings = preparedSkillRuntime.warnings;
    if (skillWarnings.length > 0) {
      emitProgress({
        message: `Skill loading warnings: ${skillWarnings.slice(0, 2).join(" / ")}`,
      });
    }
    const implicitSystemInstructionContext = options.instructionContextToggles
      .system
      ? await dependencies.buildSystemInstructionContextPayload(options)
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
      emitProgress({
        message: "Enabling Code Interpreter for non-PDF attachments...",
      });
      const nonPdfAttachments = collectNonPdfAttachments(options);
      if (nonPdfAttachments.length > 0) {
        const cachedAvailability =
          readCodeInterpreterAttachmentAvailabilityCache();
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
            codeInterpreterContainerId =
              await createCodeInterpreterContainerWithAttachments(
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
      ? dependencies.buildSkillTools(
          skillRuntime.activeSkills,
          {
            nextSequence: nextThreadOperationLogSequence,
            onRecord: emitThreadOperationLogRecord,
          },
          skillExecutionContext,
        )
      : [];

    const agent = new Agent({
      name: "LocalPlaygroundAgent",
      instructions: dependencies.buildAgentInstructionWithSkills(
        options.agentInstruction,
        skillRuntime,
        {
          instructionContextToggles: options.instructionContextToggles,
          systemInstructionContext: implicitSystemInstructionContext,
        },
      ),
      model,
      modelSettings: {
        ...(options.temperature !== null
          ? { temperature: options.temperature }
          : {}),
        ...(options.reasoningEffort
          ? { reasoning: { effort: options.reasoningEffort } }
          : {}),
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
    const currentInput = buildUserMessageInput(
      options.message,
      options.attachments,
      {
        useCodeInterpreter: enableCodeInterpreterTool,
      },
    );
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
    const { runInput } = dependencies.buildAgentRunContext({
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
        const progress = dependencies.readProgressEventFromRunStreamEvent(
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

      const assistantMessage = extractAgentFinalOutput(
        streamedResult.finalOutput,
      );
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
    await dependencies.cleanupChatRuntime({
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

export async function executeChatWithTransientRetry(
  options: ChatExecutionOptions,
  dependencies: ChatExecutionDependencies,
  onEvent?: (event: ChatExecutionEvent) => void,
  abortSignal?: AbortSignal,
): Promise<ChatExecutionResult> {
  for (
    let attempt = 1;
    attempt <= chatTransientTerminationRetryMaxAttempts;
    attempt += 1
  ) {
    try {
      throwIfAborted(abortSignal);
      return await executeChat(options, dependencies, onEvent, abortSignal);
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

export function createInitialChatMcpRuntimeMetrics(): ChatMcpRuntimeMetrics {
  return {
    mcpConnectedCount: 0,
    mcpReusedCount: 0,
    mcpEphemeralConnectCount: 0,
    mcpConnectDurationMs: 0,
    mcpSetupDurationMs: 0,
  };
}

function buildWebSearchPreviewTool(
  userLocation: WebSearchPreviewUserLocation | null,
): Tool<unknown> {
  return {
    type: "hosted_tool" as const,
    name: WEB_SEARCH_PREVIEW_TOOL_NAME,
    providerData: {
      type: "web_search_preview",
      name: WEB_SEARCH_PREVIEW_TOOL_NAME,
      search_context_size: WEB_SEARCH_PREVIEW_CONTEXT_SIZE,
      ...(userLocation ? { user_location: userLocation } : {}),
    },
  } as Tool<unknown>;
}

function shouldEnableCodeInterpreter(options: ChatExecutionOptions): boolean {
  if (hasNonPdfAttachments(options.attachments)) {
    return true;
  }

  return options.history.some(
    (entry) => entry.role === "user" && hasNonPdfAttachments(entry.attachments),
  );
}

export function hasNonPdfAttachments(
  attachments: ClientAttachment[],
): boolean {
  return attachments.some(
    (attachment) => readFileExtension(attachment.name) !== "pdf",
  );
}

function collectNonPdfAttachments(
  options: ChatExecutionOptions,
): ClientAttachment[] {
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
  client: AzureOpenAIClient,
): Promise<string> {
  const container = await awaitWithTimeout(
    client.containers.create({
      name: "local-playground-chat",
    }),
    CHAT_CODE_INTERPRETER_UPLOAD_TIMEOUT_MS,
    "Timed out while creating a Code Interpreter container.",
  );
  const containerId =
    typeof container.id === "string" ? container.id.trim() : "";
  if (!containerId) {
    throw new Error("Failed to initialize a Code Interpreter container.");
  }

  try {
    for (const attachment of attachments) {
      const parsedAttachmentDataUrl = parseAttachmentDataUrl(
        attachment.dataUrl,
        `attachments[\"${attachment.name}\"].dataUrl`,
      );
      if (!parsedAttachmentDataUrl.ok) {
        throw new Error(parsedAttachmentDataUrl.error);
      }

      const base64Payload = readDataUrlBase64Payload(
        parsedAttachmentDataUrl.value.dataUrl,
      );
      const attachmentBuffer = Buffer.from(base64Payload, "base64");
      const normalizedMimeType =
        attachment.mimeType ||
        parsedAttachmentDataUrl.value.mimeType ||
        "application/octet-stream";
      const file = await toFile(attachmentBuffer, attachment.name, {
        type: normalizedMimeType,
      });
      try {
        await awaitWithTimeout(
          client.containers.files.create(containerId, { file }),
          CHAT_CODE_INTERPRETER_UPLOAD_TIMEOUT_MS,
          `Timed out while uploading \"${attachment.name}\" to Code Interpreter.`,
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
      `Code Interpreter rejected \"${fileName}\" on this deployment. ${message}`,
    );
  }

  return new Error(
    `Failed to upload attachment \"${fileName}\" for Code Interpreter: ${message}`,
  );
}

function readCodeInterpreterAttachmentAvailabilityCache(): CodeInterpreterAttachmentAvailabilityCache | null {
  const cache = codeInterpreterAttachmentAvailabilityCache;
  if (!cache) {
    return null;
  }

  if (
    Date.now() - cache.checkedAt >
    CODE_INTERPRETER_ATTACHMENT_AVAILABILITY_CACHE_MS
  ) {
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

function markCodeInterpreterAttachmentAvailabilityUnavailable(
  reason: string,
): void {
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
  return trimmed.length <= maxLength
    ? trimmed
    : `${trimmed.slice(0, maxLength - 1)}...`;
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

  if (
    pdfAttachments.length === 0 &&
    codeInterpreterAttachmentNames.length === 0
  ) {
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

async function initializeCompactionSession(options: {
  client: AzureOpenAIClient;
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
  const hasBase64 = metadataParts.some(
    (part) => part.toLowerCase() === "base64",
  );
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

export async function runAgentWithTimeout<T>(
  runTask: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
  upstreamAbortSignal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const removeAbortRelay = relayAbortSignal(upstreamAbortSignal, controller);
  try {
    return await awaitWithTimeout(
      runTask(controller.signal),
      timeoutMs,
      timeoutMessage,
    );
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

export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal || !signal.aborted) {
    return;
  }

  throw new RequestCanceledError();
}

export function buildUpstreamErrorPayload(
  error: unknown,
  deploymentName: string,
): {
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
          'Azure authentication failed. Click "Azure Login", complete sign-in, and try again.',
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

export function isRequestCanceledError(error: unknown): boolean {
  if (error instanceof RequestCanceledError) {
    return true;
  }

  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.message === "Request was canceled.")
  );
}

export function buildUpstreamErrorMessage(
  error: unknown,
  deploymentName: string,
): string {
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

export function isTransientNetworkTerminationError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const normalizedMessage = error.message.trim().toLowerCase();
  if (
    normalizedMessage === "terminated" ||
    normalizedMessage.includes("socket closed")
  ) {
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

export function shouldRetryChatExecution(
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

export function sleep(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}
