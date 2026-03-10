import type { ThreadResource } from "~/lib/contracts/threads/types";
import type { Thread } from "~/lib/domain/entities/thread";

export function presentThreadResources(
  threads: Thread[],
): ThreadResource[] {
  return threads.map((thread) => presentThreadResource(thread));
}

export function presentThreadResource(
  thread: Thread,
): ThreadResource {
  return {
    id: thread.id,
    userId: thread.userId,
    name: thread.name,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    deletedAt: thread.deletedAt,
    reasoningEffort: thread.reasoningEffort,
    webSearchEnabled: thread.webSearchEnabled,
    chatAzureConfigJson: thread.chatAzureConfig
      ? JSON.stringify(thread.chatAzureConfig)
      : null,
    threadEnvironmentJson: JSON.stringify(thread.threadEnvironment),
    instructionContextTogglesJson: JSON.stringify(
      thread.instructionContextToggles,
    ),
    instruction: thread.instruction ? { ...thread.instruction } : null,
    messages: thread.messages.map((message) => ({
      id: message.id,
      threadId: message.threadId,
      conversationOrder: message.conversationOrder,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
      turnId: message.turnId,
      attachmentsJson: JSON.stringify(message.attachments),
      skillActivations: message.skillActivations.map((activation) => ({
        ...activation,
        skillProfile: { ...activation.skillProfile },
      })),
    })),
    mcpServers: thread.mcpServers.map((server) =>
      server.transport === "stdio"
        ? {
            id: server.id,
            threadId: server.threadId,
            selectionOrder: server.selectionOrder,
            name: server.name,
            transport: server.transport,
            command: server.command,
            argsJson: JSON.stringify(server.args),
            cwd: server.cwd,
            envJson: JSON.stringify(server.env),
            url: null,
            headersJson: null,
            useAzureAuth: false,
            azureAuthScope: null,
            timeoutSeconds: null,
          }
        : {
            id: server.id,
            threadId: server.threadId,
            selectionOrder: server.selectionOrder,
            name: server.name,
            transport: server.transport,
            url: server.url,
            headersJson: JSON.stringify(server.headers),
            useAzureAuth: server.useAzureAuth,
            azureAuthScope: server.azureAuthScope,
            timeoutSeconds: server.timeoutSeconds,
            command: null,
            argsJson: null,
            cwd: null,
            envJson: null,
          },
    ),
    mcpRpcLogs: thread.operationLogs.map((entry) => ({
      rowId: entry.rowId,
      sourceRpcId: entry.sourceRpcId,
      threadId: entry.threadId,
      conversationOrder: entry.conversationOrder,
      sequence: entry.sequence,
      operationType: entry.operationType,
      serverName: entry.serverName,
      method: entry.method,
      startedAt: entry.startedAt,
      completedAt: entry.completedAt,
      requestJson: JSON.stringify(entry.request ?? null),
      responseJson: JSON.stringify(entry.response ?? null),
      isError: entry.isError,
      turnId: entry.turnId,
    })),
    skillSelections: thread.skillSelections.map((selection) => ({
      ...selection,
      skillProfile: { ...selection.skillProfile },
    })),
  };
}
