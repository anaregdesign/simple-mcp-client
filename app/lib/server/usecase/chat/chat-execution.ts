import {
  CHAT_CLEANUP_TIMEOUT_MS,
  CHAT_MAX_RUN_TURNS,
  CHAT_MODEL_RUN_TIMEOUT_MS,
} from "~/lib/constants/chat";
import { THREAD_MCP_SERVER_SESSION_IDLE_TTL_MS } from "~/lib/constants/mcp";
import { cloneThreadEnvironment, type ThreadEnvironment } from "~/lib/domain/value-objects/thread-environment";
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

const chatTransientTerminationRetryMaxAttempts = 2;
const chatTransientTerminationRetryDelayMs = 250;

export class ChatCanceledError extends Error {
  constructor(message = "Chat execution was canceled.") {
    super(message);
    this.name = "ChatCanceledError";
  }
}

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
    const useCodeInterpreter = shouldEnableCodeInterpreter(options);
    let codeInterpreterEnabledForRun = false;
    if (useCodeInterpreter) {
      emitProgress({
        message: "Enabling Code Interpreter for non-PDF attachments...",
      });
      const nonPdfAttachments = collectNonPdfAttachments(options);
      if (nonPdfAttachments.length > 0) {
        emitProgress({
          message: `Uploading attachments for Code Interpreter (${nonPdfAttachments.length})...`,
        });
        try {
          codeInterpreterContainerId = await dependencies.createCodeInterpreterContainerWithAttachments(
            {
              attachments: nonPdfAttachments,
              azureConfig: options.azureConfig,
            },
          );
          codeInterpreterEnabledForRun = true;
        } catch (error) {
          const reason = readErrorMessage(error);
          emitProgress({
            message: `Code Interpreter file upload failed (${truncateProgressMessage(reason)}). Continuing without non-PDF file access.`,
          });
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
    const conversationSession = dependencies.createConversationSession({
      sessionId: options.agentConversationId,
      history: options.history,
      useCodeInterpreter: enableCodeInterpreterTool,
    });

    emitProgress({ message: "Sending request to Azure OpenAI..." });
    const runTimeoutSeconds = Math.ceil(CHAT_MODEL_RUN_TIMEOUT_MS / 1000);
    const runTimeoutMessage = useCodeInterpreter
      ? `Azure OpenAI request timed out after ${runTimeoutSeconds} seconds while processing file attachments. The selected deployment may not support Code Interpreter.`
      : `Azure OpenAI request timed out after ${runTimeoutSeconds} seconds.`;

    const runResult = await dependencies.runChatAgent({
      azureConfig: options.azureConfig,
      webSearchEnabled: options.webSearchEnabled,
      webSearchUserLocation: options.webSearchUserLocation,
      enableCodeInterpreterTool,
      codeInterpreterContainerId,
      connectedMcpServers,
      skillTools,
      agentInstruction: dependencies.buildAgentInstructionWithSkills(
        options.agentInstruction,
        skillRuntime,
        {
          instructionContextToggles: options.instructionContextToggles,
          systemInstructionContext: implicitSystemInstructionContext,
        },
      ),
      reasoningEffort: options.reasoningEffort,
      temperature: options.temperature,
      conversationSession,
      message: options.message,
      attachments: options.attachments,
      hasMcpServers,
      maxTurns: CHAT_MAX_RUN_TURNS,
      runTimeoutMs: CHAT_MODEL_RUN_TIMEOUT_MS,
      runTimeoutMessage,
      abortSignal,
      ...(onEvent
        ? {
            onProgressEvent: (event: ChatProgressEvent) => {
              emitProgress(event);
            },
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

function shouldEnableCodeInterpreter(options: ChatExecutionOptions): boolean {
  if (hasNonPdfAttachments(options.attachments)) {
    return true;
  }

  return options.history.some(
    (entry) => entry.role === "user" && hasNonPdfAttachments(entry.attachments),
  );
}

export function hasNonPdfAttachments(attachments: ClientAttachment[]): boolean {
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

function buildAttachmentKey(attachment: ClientAttachment): string {
  return `${attachment.name}\u0000${attachment.sizeBytes}\u0000${attachment.dataUrl}`;
}

function readFileExtension(fileName: string): string {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
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

export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal || !signal.aborted) {
    return;
  }

  throw new ChatCanceledError();
}

export function isChatCanceledError(error: unknown): boolean {
  if (error instanceof ChatCanceledError) {
    return true;
  }

  return (
    error instanceof Error &&
    (error.name === "AbortError" ||
      error.message === "Chat execution was canceled.")
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
