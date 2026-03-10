import { randomUUID } from "node:crypto";
import {
  MCP_DEFAULT_AZURE_AUTH_SCOPE,
  MCP_DEFAULT_TIMEOUT_SECONDS,
} from "~/lib/constants/mcp";
import { DEFAULT_AGENT_INSTRUCTION } from "~/lib/domain/value-objects/thread-defaults";
import type { ThreadMessage } from "~/lib/contracts/chat/messages";
import {
  type ThreadOperationLogEntry,
} from "~/lib/contracts/chat/operation-log";
import { cloneThreadEnvironment } from "~/lib/domain/value-objects/thread-environment";
import type { Thread } from "~/lib/domain/entities/thread";
import type { ThreadRepository } from "~/lib/domain/repositories/thread-repository";
import type { ThreadSkillActivation } from "~/lib/contracts/skills/types";
import {
  executeChatWithTransientRetry,
  type ChatExecutionDependencies,
  type ChatExecutionEvent,
  type ChatExecutionResult,
  type ClientMessage,
  type ThreadOperationLogRecord,
  type WebSearchPreviewUserLocation,
  hasNonPdfAttachments,
} from "~/lib/server/usecase/chat/chat-execution";
import { createChatMemorySession } from "~/lib/server/usecase/chat/chat-session";
import {
  applyDefaultThreadDirectoryToStdioServers,
  resolveRelativeHttpMcpServerUrls,
} from "~/lib/server/usecase/chat/mcp-server-config-normalization";
import type { ClientMcpServerConfig } from "~/lib/server/usecase/chat/mcp-server-config-types";
import {
  resolveWorkspaceThreadDirectory,
  resolveWorkspaceUserDirectory,
} from "~/lib/server/infrastructure/config/workspace-storage-paths";
import { upsertThreadOperationLogEntry } from "~/lib/server/usecase/chat/thread-operation-log-state";
import { buildThreadSaveInputFromThread } from "~/lib/server/usecase/threads/thread-save-input-mapper";

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
    chatExecutionDependencies: ChatExecutionDependencies;
  },
  onEvent?: (event: ChatExecutionEvent) => void,
  abortSignal?: AbortSignal,
): Promise<ThreadChatRunResult> {
  const thread = await loadThreadSnapshot(
    request,
    dependencies.threadRepository,
  );
  const azureConfig = readThreadAzureConfig(thread);
  validateThreadExecutionConfiguration(thread);

  const currentUserMessage = readCurrentUserMessage(thread, request.turnId);
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
  const useCodeInterpreter =
    hasNonPdfAttachments(currentUserMessage.attachments) ||
    history.some(
      (entry) =>
        entry.role === "user" && hasNonPdfAttachments(entry.attachments),
    );
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
  const conversationSession = createChatMemorySession({
    sessionId: thread.agentConversationId,
    history,
    useCodeInterpreter,
  });
  const agentConversationId = await conversationSession.getSessionId();
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
    agentConversationId,
    conversationSession,
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
      agentConversationId,
      threadEnvironment,
      operationLogs,
    });
    throw error;
  }
}

async function loadThreadSnapshot(
  request: ThreadChatRunRequest,
  repository: ThreadRepository,
): Promise<Thread> {
  const thread = await repository.findByIdForUser(
    request.userId,
    request.threadId,
  );
  if (!thread) {
    throw new ThreadChatRunError(404, "thread_not_found", "Thread not found.");
  }
  if (thread.isArchived()) {
    throw new ThreadChatRunError(
      409,
      "thread_archived",
      "Archived thread is read-only.",
    );
  }

  return thread;
}

function readThreadAzureConfig(thread: Thread) {
  const config = thread.chatAzureConfig;
  if (!config) {
    throw new ThreadChatRunError(
      422,
      "chat_azure_config_required",
      "Thread chatAzureConfig is required.",
    );
  }

  return config;
}

function validateThreadExecutionConfiguration(thread: Thread): void {
  if (thread.webSearchEnabled && thread.reasoningEffort === "minimal") {
    throw new ThreadChatRunError(
      422,
      "web_search_reasoning_effort_not_supported",
      "Selected Reasoning Effort cannot be used with Web Search.",
    );
  }

  if (
    thread.reasoningEffort === "minimal" &&
    thread.chatAzureConfig?.deploymentName
      .trim()
      .toLowerCase()
      .startsWith("gpt-5.4")
  ) {
    throw new ThreadChatRunError(
      422,
      "reasoning_effort_not_supported",
      "Selected Reasoning Effort is not supported by the thread deployment.",
    );
  }
}

function readCurrentUserMessage(thread: Thread, turnId: string) {
  const currentUserMessage = [...thread.messages]
    .reverse()
    .find((message) => message.turnId === turnId && message.role === "user");
  if (!currentUserMessage) {
    throw new ThreadChatRunError(
      422,
      "turn_not_found",
      "`turnId` must reference a persisted user message.",
    );
  }

  return currentUserMessage;
}

function readHistoryMessages(thread: Thread, turnId: string): ClientMessage[] {
  const currentIndex = thread.messages.findIndex(
    (message) => message.turnId === turnId && message.role === "user",
  );
  const previousMessages =
    currentIndex <= 0 ? [] : thread.messages.slice(0, currentIndex);

  return previousMessages.map((message) => ({
    role: message.role,
    content: message.content,
    attachments: message.attachments.map((attachment) => ({ ...attachment })),
  }));
}

function mergeThreadSkillSelections(
  threadSkills: ThreadSkillActivation[],
  messageSkills: ThreadSkillActivation[],
): ThreadSkillActivation[] {
  const byLocation = new Map<string, ThreadSkillActivation>();
  for (const selection of [...threadSkills, ...messageSkills]) {
    const location = selection.location.trim();
    if (!location || byLocation.has(location)) {
      continue;
    }

    byLocation.set(location, {
      name: selection.name,
      location,
    });
  }

  return [...byLocation.values()];
}

function mapThreadMcpServerToClientConfig(
  server: Thread["mcpServers"][number],
): ClientMcpServerConfig {
  if (server.transport === "stdio") {
    return {
      name: server.name,
      transport: "stdio",
      command: server.command,
      args: [...server.args],
      ...(server.cwd ? { cwd: server.cwd } : {}),
      env: { ...server.env },
    };
  }

  return {
    name: server.name,
    transport: server.transport,
    url: server.url,
    headers: { ...server.headers },
    useAzureAuth: server.useAzureAuth,
    azureAuthScope: server.azureAuthScope ?? MCP_DEFAULT_AZURE_AUTH_SCOPE,
    timeoutSeconds: server.timeoutSeconds ?? MCP_DEFAULT_TIMEOUT_SECONDS,
  };
}

function mapOperationLogRecord(
  record: ThreadOperationLogRecord,
  turnId: string,
): ThreadOperationLogEntry {
  return {
    id: record.id,
    sequence: record.sequence,
    operationType: record.operationType,
    serverName: record.serverName,
    method: record.method,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    request: record.request,
    response: record.response,
    isError: record.isError,
    turnId,
  };
}

function createAssistantMessage(
  turnId: string,
  content: string,
): ThreadMessage {
  return {
    id: `assistant-${randomUUID()}`,
    role: "assistant",
    content,
    createdAt: new Date().toISOString(),
    turnId,
    attachments: [],
    skillActivations: [],
  };
}

function presentDomainThreadMessage(
  message: Thread["messages"][number] | undefined,
): ThreadMessage | null {
  if (!message) {
    return null;
  }

  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
    turnId: message.turnId,
    attachments: message.attachments.map((attachment) => ({ ...attachment })),
    skillActivations: message.skillActivations.map((activation) => ({
      name: activation.skillProfile.name,
      location: activation.skillProfile.location,
    })),
  };
}

async function persistThreadState(options: {
  thread: Thread;
  userId: number;
  repository: ThreadRepository;
  agentConversationId: string;
  threadEnvironment: Record<string, string>;
  operationLogs: ThreadOperationLogEntry[];
  assistantMessage?: ThreadMessage;
}): Promise<Thread> {
  const payload = buildThreadSaveInputFromThread(options.thread, {
    agentConversationId: options.agentConversationId,
    threadEnvironment: options.threadEnvironment,
    operationLogs: options.operationLogs,
    assistantMessage: options.assistantMessage,
  });
  const saved = await options.repository.save(options.userId, payload);
  if (!saved) {
    throw new ThreadChatRunError(404, "thread_not_found", "Thread not found.");
  }

  return saved.thread;
}
