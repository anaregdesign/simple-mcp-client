import type { ChatAttachment } from "~/lib/contracts/chat/attachments";
import type { ThreadSkillActivation } from "~/lib/contracts/skills/types";
import type { ThreadInstructionContextToggles } from "~/lib/contracts/threads/instruction-context";
import type { ThreadEnvironment } from "~/lib/contracts/threads/environment";
import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";

export type ChatRequestMcpServer =
  | {
      name: string;
      transport: "stdio";
      command: string;
      args: string[];
      cwd?: string;
      env: Record<string, string>;
    }
  | {
      name: string;
      transport: "streamable_http" | "sse";
      url: string;
      headers: Record<string, string>;
      useAzureAuth: boolean;
      azureAuthScope: string;
      timeoutSeconds: number;
    };

export type ChatApiHistoryEntry = {
  role: "user" | "assistant";
  content: string;
  attachments?: ChatAttachment[];
};

export type ChatApiRequestPayload = {
  threadId: string;
  turnId: string;
  message: string;
  attachments: ChatAttachment[];
  history: ChatApiHistoryEntry[];
  azureConfig: {
    tenantId: string;
    projectName: string;
    baseUrl: string;
    apiVersion: string;
    deploymentName: string;
  };
  supportsReasoningEffort: boolean;
  webSearchEnabled: boolean;
  agentInstruction: string;
  instructionContextToggles: ThreadInstructionContextToggles;
  threadEnvironment: ThreadEnvironment;
  skills: ThreadSkillActivation[];
  explicitSkillLocations: string[];
  mcpServers: ChatRequestMcpServer[];
  reasoningEffort?: ReasoningEffort;
};
