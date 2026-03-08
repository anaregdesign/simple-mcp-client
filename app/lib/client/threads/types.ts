/**
 * Client runtime support module.
 */
import type { ThreadMessage } from "~/lib/client/chat/messages";
import type { ThreadOperationLogEntry } from "~/lib/client/chat/stream";
import type { McpServerConfig } from "~/lib/client/mcp/profile";
import type { ReasoningEffort } from "~/lib/client/shared/view-types";
import type { ThreadSkillActivation } from "~/lib/client/skills/types";
import type { ThreadEnvironment } from "~/lib/client/threads/environment";
import type { ThreadInstructionContextToggles } from "~/lib/client/threads/instruction-context";

export type ThreadSnapshot = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  reasoningEffort: ReasoningEffort;
  webSearchEnabled: boolean;
  agentInstruction: string;
  instructionContextToggles: ThreadInstructionContextToggles;
  threadEnvironment: ThreadEnvironment;
  messages: ThreadMessage[];
  mcpServers: McpServerConfig[];
  mcpRpcLogs: ThreadOperationLogEntry[];
  skillSelections: ThreadSkillActivation[];
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
