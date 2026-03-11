import type { ThreadMessage } from "~/lib/contracts/chat/messages";
import type { ThreadOperationLogEntry } from "~/lib/contracts/chat/operation-log";
import type { McpServerConfig } from "~/lib/contracts/mcp/profile";
import type { ThreadSkillActivation } from "~/lib/contracts/skills/types";
import { hasPersistableThreadState as hasPersistableThreadSnapshot } from "~/lib/domain/policies/thread-persistable-state";
import {
  cloneChatAzureConfig,
  type ChatAzureConfig,
} from "~/lib/domain/value-objects/chat-azure-config";
import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";
import {
  cloneThreadEnvironment,
  type ThreadEnvironment,
} from "~/lib/domain/value-objects/thread-environment";
import {
  cloneThreadInstructionContextToggles,
  type ThreadInstructionContextToggles,
} from "~/lib/domain/value-objects/thread-instruction-context";

export type ThreadSaveState = {
  id: string;
  name: string;
  createdAt: string;
  reasoningEffort: ReasoningEffort;
  webSearchEnabled: boolean;
  chatAzureConfig?: ChatAzureConfig | null;
  agentInstruction: string;
  instructionContextToggles: ThreadInstructionContextToggles;
  threadEnvironment: ThreadEnvironment;
  messages: ThreadMessage[];
  mcpServers: McpServerConfig[];
  mcpRpcLogs: ThreadOperationLogEntry[];
  skillSelections: ThreadSkillActivation[];
};

export function cloneMessages(value: ThreadMessage[]): ThreadMessage[] {
  return value.map((message) => ({
    ...message,
    attachments: message.attachments.map((attachment) => ({ ...attachment })),
    skillActivations: message.skillActivations.map((selection) => ({
      ...selection,
    })),
  }));
}

export function cloneMcpServers(value: McpServerConfig[]): McpServerConfig[] {
  return value.map((server) =>
    server.transport === "stdio"
      ? {
          ...server,
          args: [...server.args],
          env: { ...server.env },
        }
      : {
          ...server,
          headers: { ...server.headers },
        },
  );
}

export function cloneThreadOperationLogs(
  value: ThreadOperationLogEntry[],
): ThreadOperationLogEntry[] {
  return value.map((entry) => ({
    ...entry,
  }));
}

export function cloneThreadSkillActivations(
  value: ThreadSkillActivation[],
): ThreadSkillActivation[] {
  return value.map((entry) => ({
    ...entry,
  }));
}

export { cloneThreadEnvironment };

export function cloneThreadInstructionContexts(
  value: ThreadSaveState["instructionContextToggles"],
): ThreadSaveState["instructionContextToggles"] {
  return cloneThreadInstructionContextToggles(value);
}

export function buildThreadSaveSignature(snapshot: ThreadSaveState): string {
  return JSON.stringify({
    name: snapshot.name,
    reasoningEffort: snapshot.reasoningEffort,
    webSearchEnabled: snapshot.webSearchEnabled,
    chatAzureConfig: cloneChatAzureConfig(snapshot.chatAzureConfig),
    instruction: {
      content: snapshot.agentInstruction,
    },
    instructionContextToggles: snapshot.instructionContextToggles,
    threadEnvironment: snapshot.threadEnvironment,
    messages: snapshot.messages,
    mcpServers: snapshot.mcpServers,
    mcpRpcLogs: snapshot.mcpRpcLogs,
    skillSelections: snapshot.skillSelections,
  });
}

export function hasThreadInteraction(
  snapshot: Pick<ThreadSaveState, "messages"> &
    Partial<Pick<ThreadSaveState, "skillSelections">>,
): boolean {
  if (snapshot.messages.length > 0) {
    return true;
  }

  return (snapshot.skillSelections?.length ?? 0) > 0;
}

export function hasThreadPersistableState(
  snapshot: Pick<
    ThreadSaveState,
    | "messages"
    | "reasoningEffort"
    | "webSearchEnabled"
    | "chatAzureConfig"
    | "agentInstruction"
    | "instructionContextToggles"
    | "threadEnvironment"
  > &
    Partial<Pick<ThreadSaveState, "skillSelections">>,
): boolean {
  return hasPersistableThreadSnapshot({
    messageCount: snapshot.messages.length,
    skillSelectionCount: snapshot.skillSelections?.length ?? 0,
    reasoningEffort: snapshot.reasoningEffort,
    webSearchEnabled: snapshot.webSearchEnabled,
    chatAzureConfig: snapshot.chatAzureConfig,
    instructionContent: snapshot.agentInstruction,
    instructionContextToggles: snapshot.instructionContextToggles,
    threadEnvironment: snapshot.threadEnvironment,
  });
}
