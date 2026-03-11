import type { ThreadResource } from "~/lib/contracts/threads/types";
import type { Thread } from "~/lib/domain/entities/thread";
import { readThreadSnapshot } from "~/lib/domain/value-objects/thread-snapshot";

export function presentThreadResources(
  threads: Thread[],
): ThreadResource[] {
  return threads.map((thread) => presentThreadResource(thread));
}

export function presentThreadResource(
  thread: Thread,
): ThreadResource {
  const snapshot = readThreadSnapshot(thread);

  return {
    id: snapshot.id,
    userId: snapshot.userId,
    name: snapshot.name,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
    deletedAt: snapshot.deletedAt,
    reasoningEffort: snapshot.reasoningEffort,
    webSearchEnabled: snapshot.webSearchEnabled,
    chatAzureConfigJson: snapshot.chatAzureConfig
      ? JSON.stringify(snapshot.chatAzureConfig)
      : null,
    threadEnvironmentJson: JSON.stringify(snapshot.threadEnvironment),
    instructionContextTogglesJson: JSON.stringify(
      snapshot.instructionContextToggles,
    ),
    instruction: snapshot.instruction ? { ...snapshot.instruction } : null,
    messages: snapshot.messages.map((message) => ({
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
    mcpServers: snapshot.mcpServers.map((server) =>
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
    mcpRpcLogs: snapshot.operationLogs.map((entry) => ({
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
    skillSelections: snapshot.skillSelections.map((selection) => ({
      ...selection,
      skillProfile: { ...selection.skillProfile },
    })),
  };
}
