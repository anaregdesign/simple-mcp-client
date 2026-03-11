import type { Thread } from "~/lib/domain/entities/thread";
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
import {
  cloneThreadInstruction,
  type ThreadInstruction,
} from "~/lib/domain/value-objects/thread-instruction";
import {
  cloneThreadMessages,
  type ThreadMessage,
} from "~/lib/domain/value-objects/thread-message";
import {
  cloneThreadMcpServers,
  type ThreadMcpServer,
} from "~/lib/domain/value-objects/thread-mcp-server";
import {
  cloneThreadOperationLogs,
  type ThreadOperationLog,
} from "~/lib/domain/value-objects/thread-operation-log";
import {
  cloneThreadSkillSelections,
  type ThreadSkillSelection,
} from "~/lib/domain/value-objects/thread-skill";

export type ThreadSnapshot = {
  id: string;
  userId: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  reasoningEffort: ReasoningEffort;
  webSearchEnabled: boolean;
  chatAzureConfig?: ChatAzureConfig | null;
  agentConversationId?: string | null;
  threadEnvironment: ThreadEnvironment;
  instructionContextToggles: ThreadInstructionContextToggles;
  instruction: ThreadInstruction | null;
  messages: ThreadMessage[];
  mcpServers: ThreadMcpServer[];
  operationLogs: ThreadOperationLog[];
  skillSelections: ThreadSkillSelection[];
};

export function cloneThreadSnapshot(snapshot: ThreadSnapshot): ThreadSnapshot {
  return {
    ...snapshot,
    chatAzureConfig: cloneChatAzureConfig(snapshot.chatAzureConfig),
    agentConversationId: snapshot.agentConversationId ?? null,
    threadEnvironment: cloneThreadEnvironment(snapshot.threadEnvironment),
    instructionContextToggles: cloneThreadInstructionContextToggles(
      snapshot.instructionContextToggles,
    ),
    instruction: cloneThreadInstruction(snapshot.instruction),
    messages: cloneThreadMessages(snapshot.messages),
    mcpServers: cloneThreadMcpServers(snapshot.mcpServers),
    operationLogs: cloneThreadOperationLogs(snapshot.operationLogs),
    skillSelections: cloneThreadSkillSelections(snapshot.skillSelections),
  };
}

export function readThreadSnapshot(thread: Thread): ThreadSnapshot {
  return {
    id: thread.id,
    userId: thread.userId,
    name: thread.name,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    deletedAt: thread.deletedAt,
    reasoningEffort: thread.reasoningEffort,
    webSearchEnabled: thread.webSearchEnabled,
    chatAzureConfig: thread.chatAzureConfig,
    agentConversationId: thread.agentConversationId,
    threadEnvironment: thread.threadEnvironment,
    instructionContextToggles: thread.instructionContextToggles,
    instruction: thread.instruction,
    messages: thread.messages,
    mcpServers: thread.mcpServers,
    operationLogs: thread.operationLogs,
    skillSelections: thread.skillSelections,
  };
}
