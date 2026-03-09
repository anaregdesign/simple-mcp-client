import type { Prisma } from "@prisma/client";
import type { ThreadMessage } from "~/lib/contracts/chat/messages";
import type { ThreadOperationLogEntry } from "~/lib/contracts/chat/operation-log";
import type { McpServerConfig } from "~/lib/contracts/mcp/profile";
import type { ThreadSkillActivation } from "~/lib/contracts/skills/types";
import type { ThreadEnvironment } from "~/lib/contracts/threads/environment";
import type { ThreadInstructionContextToggles } from "~/lib/contracts/threads/instruction-context";
import type { ReasoningEffort } from "~/lib/domain/shared/reasoning-effort";

export type ThreadResource = Prisma.ThreadGetPayload<{
  include: {
    instruction: true;
    messages: {
      include: {
        skillActivations: {
          include: {
            skillProfile: true;
          };
        };
      };
    };
    mcpServers: true;
    mcpRpcLogs: true;
    skillSelections: {
      include: {
        skillProfile: true;
      };
    };
  };
}>;

export type ThreadWritePayload = {
  id: string;
  name: string;
  createdAt: string;
  reasoningEffort: ReasoningEffort;
  webSearchEnabled: boolean;
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
