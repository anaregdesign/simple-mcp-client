import { randomUUID } from "node:crypto";
import {
  MCP_DEFAULT_AZURE_AUTH_SCOPE,
  MCP_DEFAULT_TIMEOUT_SECONDS,
} from "~/lib/constants/mcp";
import type { ThreadMessage } from "~/lib/contracts/chat/messages";
import {
  type ThreadOperationLogEntry,
} from "~/lib/contracts/chat/operation-log";
import type { ThreadSkillActivation } from "~/lib/contracts/skills/types";
import type { Thread } from "~/lib/domain/entities/thread";
import type { ClientMessage } from "~/lib/server/usecase/chat/chat-execution-ports";
import type { ClientMcpServerConfig } from "~/lib/server/usecase/chat/mcp-server-config-types";

export function readHistoryMessages(
  thread: Thread,
  turnId: string,
): ClientMessage[] {
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

export function mergeThreadSkillSelections(
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

export function mapThreadMcpServerToClientConfig(
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

export function mapOperationLogRecord(
  record: {
    id: string;
    sequence: number;
    operationType: "mcp" | "skill";
    serverName: string;
    method: string;
    startedAt: string;
    completedAt: string;
    request: ThreadOperationLogEntry["request"];
    response: ThreadOperationLogEntry["response"];
    isError: boolean;
  },
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

export function createAssistantMessage(
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

export function presentDomainThreadMessage(
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
