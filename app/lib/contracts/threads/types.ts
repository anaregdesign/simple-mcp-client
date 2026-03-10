import type { ThreadMessage } from "~/lib/contracts/chat/messages";
import type { ThreadOperationLogEntry } from "~/lib/contracts/chat/operation-log";
import type { McpServerConfig } from "~/lib/contracts/mcp/profile";
import type { WorkspaceSkillProfileResource } from "~/lib/contracts/skills/workspace-skill-profiles";
import type { ThreadSkillActivation } from "~/lib/contracts/skills/types";
import type { ThreadEnvironment } from "~/lib/contracts/threads/environment";
import type { ThreadInstructionContextToggles } from "~/lib/contracts/threads/instruction-context";
import type { ChatAzureConfig } from "~/lib/domain/value-objects/chat-azure-config";
import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";

export type ThreadInstructionResource = {
  id: number;
  threadId: string;
  content: string;
};

export type ThreadMessageSkillActivationResource = {
  id: string;
  messageId: string;
  selectionOrder: number;
  skillProfileId: number;
  skillProfile: WorkspaceSkillProfileResource;
};

export type ThreadMessageResource = {
  id: string;
  threadId: string;
  conversationOrder: number;
  role: string;
  content: string;
  createdAt: string;
  turnId: string;
  attachmentsJson: string;
  skillActivations: ThreadMessageSkillActivationResource[];
};

export type ThreadMcpServerResource = {
  id: string;
  threadId: string;
  selectionOrder: number;
  name: string;
  transport: string;
  url: string | null;
  headersJson: string | null;
  useAzureAuth: boolean;
  azureAuthScope: string | null;
  timeoutSeconds: number | null;
  command: string | null;
  argsJson: string | null;
  cwd: string | null;
  envJson: string | null;
};

export type ThreadOperationLogResource = {
  rowId: string;
  sourceRpcId: string;
  threadId: string;
  conversationOrder: number;
  sequence: number;
  operationType: string;
  serverName: string;
  method: string;
  startedAt: string;
  completedAt: string;
  requestJson: string;
  responseJson: string;
  isError: boolean;
  turnId: string;
};

export type ThreadSkillActivationResource = {
  id: string;
  threadId: string;
  selectionOrder: number;
  skillProfileId: number;
  skillProfile: WorkspaceSkillProfileResource;
};

export type ThreadResource = {
  id: string;
  userId: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  reasoningEffort: string;
  webSearchEnabled: boolean;
  chatAzureConfigJson?: string | null;
  threadEnvironmentJson: string;
  instructionContextTogglesJson: string;
  instruction: ThreadInstructionResource | null;
  messages: ThreadMessageResource[];
  mcpServers: ThreadMcpServerResource[];
  mcpRpcLogs: ThreadOperationLogResource[];
  skillSelections: ThreadSkillActivationResource[];
};

export type ThreadWritePayload = {
  id: string;
  name: string;
  createdAt: string;
  reasoningEffort: ReasoningEffort;
  webSearchEnabled: boolean;
  chatAzureConfig?: ChatAzureConfig | null;
  instruction: {
    content: string;
  };
  instructionContextToggles: ThreadInstructionContextToggles;
  threadEnvironment: ThreadEnvironment;
  messages: ThreadMessage[];
  mcpServers: McpServerConfig[];
  mcpRpcLogs: ThreadOperationLogEntry[];
  skillSelections: ThreadSkillActivation[];
};

export type ThreadState = Omit<ThreadWritePayload, "instruction"> & {
  updatedAt: string;
  deletedAt: string | null;
  agentConversationId?: string | null;
  agentInstruction: string;
};

export type ThreadSummary = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  messageCount: number;
  mcpServerCount: number;
};
