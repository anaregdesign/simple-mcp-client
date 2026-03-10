import {
  MCP_DEFAULT_AZURE_AUTH_SCOPE,
  MCP_DEFAULT_TIMEOUT_SECONDS,
} from "~/lib/constants/mcp";
import type { ThreadMessage as ChatThreadMessage } from "~/lib/contracts/chat/messages";
import type { ThreadOperationLogEntry } from "~/lib/contracts/chat/operation-log";
import type { ThreadWritePayload } from "~/lib/contracts/threads/types";
import type { Thread } from "~/lib/domain/entities/thread";
import type {
  ThreadSaveInput,
  ThreadSaveMcpServer,
  ThreadSaveMessage,
  ThreadSaveOperationLog,
} from "~/lib/domain/repositories/thread-repository";
import { cloneChatAzureConfig } from "~/lib/domain/value-objects/chat-azure-config";
import { cloneThreadAttachments } from "~/lib/domain/value-objects/thread-attachment";
import { DEFAULT_AGENT_INSTRUCTION } from "~/lib/domain/value-objects/thread-defaults";
import { cloneThreadEnvironment } from "~/lib/domain/value-objects/thread-environment";
import { cloneThreadInstructionContextToggles } from "~/lib/domain/value-objects/thread-instruction-context";
import type { ThreadMessage } from "~/lib/domain/value-objects/thread-message";
import type { ThreadMcpServer } from "~/lib/domain/value-objects/thread-mcp-server";
import { readThreadSnapshot } from "~/lib/domain/value-objects/thread-snapshot";
import {
  cloneThreadSkillReferences,
  toThreadSkillReference,
} from "~/lib/domain/value-objects/thread-skill";

export function buildThreadSaveInputFromThread(
  thread: Thread,
  options: {
    agentConversationId: string;
    threadEnvironment: Record<string, string>;
    operationLogs: ThreadOperationLogEntry[];
    assistantMessage?: ChatThreadMessage;
  },
): ThreadSaveInput {
  const snapshot = readThreadSnapshot(thread);

  return {
    id: snapshot.id,
    name: snapshot.name,
    createdAt: snapshot.createdAt,
    reasoningEffort: snapshot.reasoningEffort,
    webSearchEnabled: snapshot.webSearchEnabled,
    chatAzureConfig: cloneChatAzureConfig(snapshot.chatAzureConfig),
    agentConversationId: options.agentConversationId,
    instructionContent:
      snapshot.instruction?.content ?? DEFAULT_AGENT_INSTRUCTION,
    instructionContextToggles: cloneThreadInstructionContextToggles(
      snapshot.instructionContextToggles,
    ),
    threadEnvironment: cloneThreadEnvironment(options.threadEnvironment),
    messages: [
      ...snapshot.messages.map(mapDomainThreadMessageToSaveMessage),
      ...(options.assistantMessage
        ? [mapChatThreadMessageToSaveMessage(options.assistantMessage)]
        : []),
    ],
    mcpServers: snapshot.mcpServers.map(mapThreadMcpServerToSaveMcpServer),
    operationLogs: options.operationLogs.map(
      mapThreadOperationLogEntryToSaveOperationLog,
    ),
    skillSelections: snapshot.skillSelections.map((selection) =>
      toThreadSkillReference(selection.skillProfile),
    ),
  };
}

export function mapThreadWritePayloadToSaveInput(
  payload: ThreadWritePayload,
): ThreadSaveInput {
  return {
    id: payload.id,
    name: payload.name,
    createdAt: payload.createdAt,
    reasoningEffort: payload.reasoningEffort,
    webSearchEnabled: payload.webSearchEnabled,
    chatAzureConfig: cloneChatAzureConfig(payload.chatAzureConfig),
    instructionContent: payload.instruction.content,
    instructionContextToggles: cloneThreadInstructionContextToggles(
      payload.instructionContextToggles,
    ),
    threadEnvironment: cloneThreadEnvironment(payload.threadEnvironment),
    messages: payload.messages.map(mapChatThreadMessageToSaveMessage),
    mcpServers: payload.mcpServers.map(mapThreadWriteMcpServerToSaveMcpServer),
    operationLogs: payload.mcpRpcLogs.map(
      mapThreadOperationLogEntryToSaveOperationLog,
    ),
    skillSelections: cloneThreadSkillReferences(payload.skillSelections),
  };
}

function mapDomainThreadMessageToSaveMessage(
  message: ThreadMessage,
): ThreadSaveMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
    turnId: message.turnId,
    attachments: cloneThreadAttachments(message.attachments),
    skillActivations: message.skillActivations.map((activation) =>
      toThreadSkillReference(activation.skillProfile),
    ),
  };
}

function mapChatThreadMessageToSaveMessage(
  message: ChatThreadMessage,
): ThreadSaveMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
    turnId: message.turnId,
    attachments: cloneThreadAttachments(message.attachments),
    skillActivations: cloneThreadSkillReferences(message.skillActivations),
  };
}

function mapThreadMcpServerToSaveMcpServer(
  server: ThreadMcpServer,
): ThreadSaveMcpServer {
  return server.transport === "stdio"
    ? {
        id: server.id,
        name: server.name,
        transport: "stdio",
        command: server.command,
        args: [...server.args],
        ...(server.cwd ? { cwd: server.cwd } : {}),
        env: { ...server.env },
      }
    : {
        id: server.id,
        name: server.name,
        transport: server.transport,
        url: server.url,
        headers: { ...server.headers },
        useAzureAuth: server.useAzureAuth,
        azureAuthScope:
          server.azureAuthScope ?? MCP_DEFAULT_AZURE_AUTH_SCOPE,
        timeoutSeconds: server.timeoutSeconds ?? MCP_DEFAULT_TIMEOUT_SECONDS,
      };
}

function mapThreadWriteMcpServerToSaveMcpServer(
  server: ThreadWritePayload["mcpServers"][number],
): ThreadSaveMcpServer {
  return server.transport === "stdio"
    ? {
        id: server.id,
        name: server.name,
        ...(typeof server.connectOnThreadCreate === "boolean"
          ? { connectOnThreadCreate: server.connectOnThreadCreate }
          : {}),
        transport: "stdio",
        command: server.command,
        args: [...server.args],
        ...(server.cwd ? { cwd: server.cwd } : {}),
        env: { ...server.env },
      }
    : {
        id: server.id,
        name: server.name,
        ...(typeof server.connectOnThreadCreate === "boolean"
          ? { connectOnThreadCreate: server.connectOnThreadCreate }
          : {}),
        transport: server.transport,
        url: server.url,
        headers: { ...server.headers },
        useAzureAuth: server.useAzureAuth,
        azureAuthScope: server.azureAuthScope,
        timeoutSeconds: server.timeoutSeconds,
      };
}

function mapThreadOperationLogEntryToSaveOperationLog(
  entry: ThreadOperationLogEntry,
): ThreadSaveOperationLog {
  return {
    id: entry.id,
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
  };
}
