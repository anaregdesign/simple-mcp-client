import {
  CHAT_CLEANUP_TIMEOUT_MS,
} from "~/lib/constants/chat";
import { THREAD_MCP_SERVER_SESSION_IDLE_TTL_MS } from "~/lib/constants/mcp";
import { cloneThreadEnvironment, type ThreadEnvironment } from "~/lib/domain/value-objects/thread-environment";
import {
  prepareCodeInterpreterRun,
} from "~/lib/server/usecase/chat/chat-code-interpreter";
import {
  awaitWithTimeout,
  ChatCanceledError,
  readErrorMessage,
  shouldRetryChatExecution,
  sleep,
  throwIfAborted,
} from "~/lib/server/usecase/chat/chat-execution-errors";
import {
  runChatAgentExecution,
} from "~/lib/server/usecase/chat/chat-agent-run";
import type {
  ChatExecutionEvent,
  ChatExecutionOptions,
  ChatExecutionPorts,
  ChatExecutionResult,
  ChatMcpRuntimeMetrics,
  ChatProgressEvent,
  ClientAttachment,
  JsonRpcRequestPayload,
  JsonRpcResponsePayload,
  McpRequestContext,
  McpServerSessionRefreshState,
  SkillToolExecutionContext,
  ThreadMcpServerSessionLeaseLike,
  ThreadOperationLogRecord,
} from "~/lib/server/usecase/chat/chat-execution-ports";

export type {
  ChatExecutionEvent,
  ChatExecutionOptions,
  ChatExecutionResult,
  ChatMcpRuntimeMetrics,
  InstructionSystemContextPayload,
} from "~/lib/server/usecase/chat/chat-execution-ports";
export {
  ChatCanceledError,
} from "~/lib/server/usecase/chat/chat-execution-errors";

const chatTransientTerminationRetryMaxAttempts = 2;
const chatTransientTerminationRetryDelayMs = 250;

export async function executeChat(
  options: ChatExecutionOptions,
  dependencies: ChatExecutionPorts,
  onEvent?: (event: ChatExecutionEvent) => void,
  abortSignal?: AbortSignal,
): Promise<ChatExecutionResult> {
  throwIfAborted(abortSignal);
  const connectedMcpServers: unknown[] = [];
  const connectedMcpServerLeases: ThreadMcpServerSessionLeaseLike[] = [];
  let codeInterpreterContainerId = "";
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
        const connectRequestId = dependencies.buildThreadOperationLogRequestId(
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
            sessionKey:
              dependencies.buildMcpServerSessionConfigKey(serverConfig),
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
              threadEnvironment: options.threadEnvironment,
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
    if (options.webSearchEnabled) {
      emitProgress({ message: "Enabling web search..." });
    }
    const codeInterpreter = await prepareCodeInterpreterRun({
      execution: options,
      dependencies,
      emitProgress,
    });
    codeInterpreterContainerId = codeInterpreter.codeInterpreterContainerId;
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
    emitProgress({ message: "Sending request to Azure OpenAI..." });
    const { runResult } = await runChatAgentExecution({
      execution: options,
      dependencies,
      connectedMcpServers,
      skillRuntime,
      skillTools,
      implicitSystemInstructionContext,
      enableCodeInterpreterTool: codeInterpreter.enableCodeInterpreterTool,
      codeInterpreterContainerId,
      hasMcpServers,
      abortSignal,
      ...(onEvent
        ? {
            onProgressEvent: emitProgress,
          }
        : {}),
    });

    if (onEvent) {
      emitProgress({ message: "Finalizing response..." });
    }

    const nextThreadEnvironment = skillExecutionContext
      ? cloneThreadEnvironment(skillExecutionContext.threadEnvironment)
      : cloneThreadEnvironment(options.threadEnvironment);
    return {
      message: runResult.assistantMessage,
      threadEnvironment: nextThreadEnvironment,
      operationLogCount: operationLogSequence,
      mcpRuntimeMetrics,
      agentConversationId: runResult.agentConversationId,
    };
  } finally {
    await dependencies.cleanupChatRuntime({
      codeInterpreterContainerId,
      deleteCodeInterpreterContainer: async (containerId) =>
        dependencies.deleteCodeInterpreterContainer({
          containerId,
          azureConfig: options.azureConfig,
        }),
      mcpServerLeases: connectedMcpServerLeases,
      awaitWithTimeout,
      cleanupTimeoutMs: CHAT_CLEANUP_TIMEOUT_MS,
    });
  }
}

export async function executeChatWithTransientRetry(
  options: ChatExecutionOptions,
  dependencies: ChatExecutionPorts,
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
