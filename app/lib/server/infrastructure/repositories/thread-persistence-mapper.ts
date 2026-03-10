import type { Prisma } from "@prisma/client";
import { DEFAULT_THREAD_INSTRUCTION_CONTEXT_TOGGLES } from "~/lib/domain/value-objects/thread-instruction-context";
import { readChatAzureConfigFromUnknown } from "~/lib/domain/value-objects/chat-azure-config";
import {
  reasoningEffortValues,
  type ReasoningEffort,
} from "~/lib/domain/value-objects/reasoning-effort";
import type { ThreadSnapshot } from "~/lib/domain/value-objects/thread-snapshot";

export const threadRowInclude = {
  instruction: true,
  messages: {
    orderBy: {
      conversationOrder: "asc",
    },
    include: {
      skillActivations: {
        orderBy: {
          selectionOrder: "asc",
        },
        include: {
          skillProfile: true,
        },
      },
    },
  },
  mcpServers: {
    orderBy: {
      selectionOrder: "asc",
    },
  },
  mcpRpcLogs: {
    orderBy: {
      conversationOrder: "asc",
    },
  },
  skillSelections: {
    orderBy: {
      selectionOrder: "asc",
    },
    include: {
      skillProfile: true,
    },
  },
} as const;

export type PersistedThreadRow = Prisma.ThreadGetPayload<{
  include: typeof threadRowInclude;
}>;

export function mapThreadRowToThreadSnapshot(
  record: PersistedThreadRow,
): ThreadSnapshot {
  return {
    id: record.id,
    userId: record.userId,
    name: record.name,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    deletedAt: record.deletedAt,
    reasoningEffort: readReasoningEffort(record.reasoningEffort),
    webSearchEnabled: record.webSearchEnabled,
    chatAzureConfig: readChatAzureConfigFromUnknown(
      readJsonValue(record.chatAzureConfigJson, null),
    ),
    agentConversationId: normalizeOptionalLabel(record.agentConversationId),
    threadEnvironment: readJsonValue(record.threadEnvironmentJson, {}),
    instructionContextToggles: readJsonValue(
      record.instructionContextTogglesJson,
      DEFAULT_THREAD_INSTRUCTION_CONTEXT_TOGGLES,
    ),
    instruction: record.instruction
      ? {
          id: record.instruction.id,
          threadId: record.instruction.threadId,
          content: record.instruction.content,
        }
      : null,
    messages: record.messages.map((message) => ({
      id: message.id,
      threadId: message.threadId,
      conversationOrder: message.conversationOrder,
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.content,
      createdAt: message.createdAt,
      turnId: message.turnId,
      attachments: readJsonValue(message.attachmentsJson, []),
      skillActivations: message.skillActivations.map((activation) => ({
        id: activation.id,
        messageId: activation.messageId,
        selectionOrder: activation.selectionOrder,
        skillProfileId: activation.skillProfileId,
        skillProfile: { ...activation.skillProfile },
      })),
    })),
    mcpServers: record.mcpServers.map((server) =>
      server.transport === "stdio"
        ? {
            id: server.id,
            threadId: server.threadId,
            selectionOrder: server.selectionOrder,
            name: server.name,
            transport: "stdio",
            command: server.command ?? "",
            args: readJsonValue(server.argsJson, []),
            cwd: server.cwd,
            env: readJsonValue(server.envJson, {}),
          }
        : {
            id: server.id,
            threadId: server.threadId,
            selectionOrder: server.selectionOrder,
            name: server.name,
            transport: server.transport === "sse" ? "sse" : "streamable_http",
            url: server.url ?? "",
            headers: readJsonValue(server.headersJson, {}),
            useAzureAuth: server.useAzureAuth,
            azureAuthScope: server.azureAuthScope,
            timeoutSeconds: server.timeoutSeconds,
          },
    ),
    operationLogs: record.mcpRpcLogs.map((entry) => ({
      rowId: entry.rowId,
      sourceRpcId: entry.sourceRpcId,
      threadId: entry.threadId,
      conversationOrder: entry.conversationOrder,
      sequence: entry.sequence,
      operationType: entry.operationType === "skill" ? "skill" : "mcp",
      serverName: entry.serverName,
      method: entry.method,
      startedAt: entry.startedAt,
      completedAt: entry.completedAt,
      request: readJsonValue(entry.requestJson, null),
      response: readJsonValue(entry.responseJson, null),
      isError: entry.isError,
      turnId: entry.turnId,
    })),
    skillSelections: record.skillSelections.map((selection) => ({
      id: selection.id,
      threadId: selection.threadId,
      selectionOrder: selection.selectionOrder,
      skillProfileId: selection.skillProfileId,
      skillProfile: { ...selection.skillProfile },
    })),
  };
}

function normalizeOptionalLabel(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function readJsonValue<T>(value: string | null, fallback: T): T {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function readReasoningEffort(value: string): ReasoningEffort {
  return reasoningEffortValues.includes(value as ReasoningEffort)
    ? (value as ReasoningEffort)
    : "medium";
}
