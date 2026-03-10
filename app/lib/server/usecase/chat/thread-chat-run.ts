import { randomUUID } from "node:crypto";
import type { ThreadMessage } from "~/lib/contracts/chat/messages";
import {
  DEFAULT_AGENT_INSTRUCTION,
} from "~/lib/domain/value-objects/thread-defaults";
import { cloneThreadEnvironment } from "~/lib/domain/value-objects/thread-environment";
import { upsertThreadOperationLogEntry } from "~/lib/domain/value-objects/thread-operation-log";
import type { Thread } from "~/lib/domain/entities/thread";
import type { ThreadRepository } from "~/lib/domain/repositories/thread-repository";
import {
  executeChatWithTransientRetry,
  type ChatExecutionEvent,
  type ChatExecutionResult,
} from "~/lib/server/usecase/chat/chat-execution";
import type {
  ChatExecutionPorts,
  ClientMessage,
  ThreadOperationLogRecord,
  WebSearchPreviewUserLocation,
} from "~/lib/server/usecase/chat/chat-execution-ports";
import {
  applyDefaultThreadDirectoryToStdioServers,
  resolveRelativeHttpMcpServerUrls,
} from "~/lib/server/usecase/chat/mcp-server-config-normalization";
import {
  createAssistantMessage,
  mapOperationLogRecord,
  mapThreadMcpServerToClientConfig,
  mergeThreadSkillSelections,
  presentDomainThreadMessage,
  readHistoryMessages,
} from "~/lib/server/usecase/chat/thread-chat-run-mappers";
import {
  persistThreadState,
} from "~/lib/server/usecase/chat/thread-chat-run-persistence";
import {
  loadThreadSnapshot,
  readCurrentUserMessage,
  readThreadAzureConfig,
  validateThreadExecutionConfiguration,
} from "~/lib/server/usecase/chat/thread-chat-run-validation";
import {
  resolveWorkspaceThreadDirectory,
  resolveWorkspaceUserDirectory,
} from "~/lib/server/infrastructure/config/workspace-storage-paths";

export type ThreadChatRunRequest = {
  userId: number;
  threadId: string;
  turnId: string;
  requestOrigin: string;
  clientUserAgent: string | null;
  clientPlatform: string | null;
  webSearchUserLocation: WebSearchPreviewUserLocation | null;
};

export type ThreadChatRunResult = {
  assistantMessage: ThreadMessage;
  threadEnvironment: Record<string, string>;
  operationLogCount: number;
  mcpRuntimeMetrics: ChatExecutionResult["mcpRuntimeMetrics"];
  agentConversationId: string;
};

export class ThreadChatRunError extends Error {
  constructor(
    readonly status: 404 | 409 | 422,
    readonly code:
      | "thread_not_found"
      | "thread_archived"
      | "chat_azure_config_required"
      | "turn_not_found"
      | "reasoning_effort_not_supported"
      | "web_search_reasoning_effort_not_supported",
    message: string,
  ) {
    super(message);
    this.name = "ThreadChatRunError";
  }
}

export function isThreadChatRunError(
  error: unknown,
): error is ThreadChatRunError {
  return error instanceof ThreadChatRunError;
}

export async function executeThreadChatRun(
  request: ThreadChatRunRequest,
  dependencies: {
    threadRepository: ThreadRepository;
    chatExecutionDependencies: ChatExecutionPorts;
  },
  onEvent?: (event: ChatExecutionEvent) => void,
  abortSignal?: AbortSignal,
): Promise<ThreadChatRunResult> {
  const thread = await loadThreadSnapshot(
    request,
    dependencies.threadRepository,
    createThreadChatRunError,
  );
  const azureConfig = readThreadAzureConfig(thread, createThreadChatRunError);
  validateThreadExecutionConfiguration(thread, createThreadChatRunError);

  const currentUserMessage = readCurrentUserMessage(
    thread,
    request.turnId,
    createThreadChatRunError,
  );
  const skillSelections = mergeThreadSkillSelections(
    thread.skillSelections.map((selection) => ({
      name: selection.skillProfile.name,
      location: selection.skillProfile.location,
    })),
    currentUserMessage.skillActivations.map((activation) => ({
      name: activation.skillProfile.name,
      location: activation.skillProfile.location,
    })),
  );
  const threadEnvironment = cloneThreadEnvironment(thread.threadEnvironment);
  const history = readHistoryMessages(thread, request.turnId);
  const operationLogs = thread.operationLogs.map((entry) => ({
    id: entry.rowId,
    sequence: entry.sequence,
    operationType: entry.operationType,
    serverName: entry.serverName,
    method: entry.method,
    startedAt: entry.startedAt,
    completedAt: entry.completedAt,
    request: entry.request,
    response: entry.response,
    isError: entry.isError,
    turnId: entry.turnId,
  }));
  const userDirectoryPath = resolveWorkspaceUserDirectory({
    workspaceUserId: request.userId,
  });
  const threadDirectoryPath = resolveWorkspaceThreadDirectory({
    workspaceUserId: request.userId,
    threadId: request.threadId,
  });
  const mcpServers = resolveRelativeHttpMcpServerUrls(
    applyDefaultThreadDirectoryToStdioServers(
      thread.mcpServers.map(mapThreadMcpServerToClientConfig),
      threadDirectoryPath,
      userDirectoryPath,
    ),
    request.requestOrigin,
  );
  const executionOptions = {
    threadId: request.threadId,
    turnId: request.turnId,
    userId: request.userId,
    clientUserAgent: request.clientUserAgent,
    clientPlatform: request.clientPlatform,
    message: currentUserMessage.content,
    attachments: currentUserMessage.attachments.map((attachment) => ({
      ...attachment,
    })),
    history,
    reasoningEffort: thread.reasoningEffort,
    webSearchEnabled: thread.webSearchEnabled,
    webSearchUserLocation: request.webSearchUserLocation,
    temperature: null,
    agentInstruction: thread.instruction?.content ?? DEFAULT_AGENT_INSTRUCTION,
    instructionContextToggles: {
      ...thread.instructionContextToggles,
    },
    threadEnvironment,
    skills: skillSelections,
    explicitSkillLocations: skillSelections.map(
      (selection) => selection.location,
    ),
    azureConfig,
    agentConversationId: thread.agentConversationId,
    mcpServers,
  } as const;

  const handleExecutionEvent = (event: ChatExecutionEvent) => {
    if (event.type === "operation_log") {
      const nextEntry = mapOperationLogRecord(event.record, request.turnId);
      const nextOperationLogs = upsertThreadOperationLogEntry(
        operationLogs,
        nextEntry,
      );
      operationLogs.splice(0, operationLogs.length, ...nextOperationLogs);
    }
    onEvent?.(event);
  };

  try {
    const result = await executeChatWithTransientRetry(
      executionOptions,
      dependencies.chatExecutionDependencies,
      handleExecutionEvent,
      abortSignal,
    );
    const assistantMessage = createAssistantMessage(
      request.turnId,
      result.message,
    );
    const persistedThread = await persistThreadState({
      thread,
      userId: request.userId,
      repository: dependencies.threadRepository,
      agentConversationId: result.agentConversationId,
      threadEnvironment: result.threadEnvironment,
      operationLogs,
      assistantMessage,
      createNotFoundError: () =>
        createThreadChatRunError(404, "thread_not_found", "Thread not found."),
    });

    return {
      assistantMessage:
        presentDomainThreadMessage(
          persistedThread.messages.find(
            (message) => message.id === assistantMessage.id,
          ),
        ) ?? assistantMessage,
      threadEnvironment: result.threadEnvironment,
      operationLogCount: result.operationLogCount,
      mcpRuntimeMetrics: result.mcpRuntimeMetrics,
      agentConversationId: result.agentConversationId,
    };
  } catch (error) {
    await persistThreadState({
      thread,
      userId: request.userId,
      repository: dependencies.threadRepository,
      agentConversationId: thread.agentConversationId ?? null,
      threadEnvironment,
      operationLogs,
      createNotFoundError: () =>
        createThreadChatRunError(404, "thread_not_found", "Thread not found."),
    });
    throw error;
  }
}

function createThreadChatRunError(
  status: 404 | 409 | 422,
  code:
    | "thread_not_found"
    | "thread_archived"
    | "chat_azure_config_required"
    | "turn_not_found"
    | "reasoning_effort_not_supported"
    | "web_search_reasoning_effort_not_supported",
  message: string,
): ThreadChatRunError {
  return new ThreadChatRunError(status, code, message);
}
