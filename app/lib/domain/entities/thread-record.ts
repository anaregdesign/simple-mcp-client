import type { ChatAttachment } from "~/lib/contracts/chat/attachments";
import type { ThreadMessage } from "~/lib/contracts/chat/messages";
import type { ThreadOperationLogEntry } from "~/lib/contracts/chat/operation-log";
import type { McpServerConfig } from "~/lib/contracts/mcp/profile";
import type { WorkspaceSkillProfileResource } from "~/lib/contracts/skills/workspace-skill-profiles";
import type { ThreadSkillActivation } from "~/lib/contracts/skills/types";
import type { ThreadEnvironment } from "~/lib/contracts/threads/environment";
import type { ThreadInstructionContextToggles } from "~/lib/contracts/threads/instruction-context";
import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";

export type ThreadRecordInput = {
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

export type ThreadSkillProfileRecord = WorkspaceSkillProfileResource;

export type ThreadInstructionRecord = {
  id: number;
  threadId: string;
  content: string;
};

export type ThreadMessageSkillActivationRecord = {
  id: string;
  messageId: string;
  selectionOrder: number;
  skillProfileId: number;
  skillProfile: ThreadSkillProfileRecord;
};

export type ThreadMessageRecord = {
  id: string;
  threadId: string;
  conversationOrder: number;
  role: ThreadMessage["role"];
  content: string;
  createdAt: string;
  turnId: string;
  attachments: ChatAttachment[];
  skillActivations: ThreadMessageSkillActivationRecord[];
};

export type ThreadMcpHttpServerRecord = {
  id: string;
  threadId: string;
  selectionOrder: number;
  name: string;
  transport: "streamable_http" | "sse";
  url: string;
  headers: Record<string, string>;
  useAzureAuth: boolean;
  azureAuthScope: string | null;
  timeoutSeconds: number | null;
};

export type ThreadMcpStdioServerRecord = {
  id: string;
  threadId: string;
  selectionOrder: number;
  name: string;
  transport: "stdio";
  command: string;
  args: string[];
  cwd: string | null;
  env: Record<string, string>;
};

export type ThreadMcpServerRecord =
  | ThreadMcpHttpServerRecord
  | ThreadMcpStdioServerRecord;

export type ThreadOperationLogRecord = {
  rowId: string;
  sourceRpcId: string;
  threadId: string;
  conversationOrder: number;
  sequence: number;
  operationType: ThreadOperationLogEntry["operationType"];
  serverName: string;
  method: string;
  startedAt: string;
  completedAt: string;
  request: unknown;
  response: unknown;
  isError: boolean;
  turnId: string;
};

export type ThreadSkillActivationRecord = {
  id: string;
  threadId: string;
  selectionOrder: number;
  skillProfileId: number;
  skillProfile: ThreadSkillProfileRecord;
};

export type ThreadRecordSnapshot = {
  id: string;
  userId: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  reasoningEffort: ReasoningEffort;
  webSearchEnabled: boolean;
  threadEnvironment: ThreadEnvironment;
  instructionContextToggles: ThreadInstructionContextToggles;
  instruction: ThreadInstructionRecord | null;
  messages: ThreadMessageRecord[];
  mcpServers: ThreadMcpServerRecord[];
  mcpRpcLogs: ThreadOperationLogRecord[];
  skillSelections: ThreadSkillActivationRecord[];
};

export class ThreadRecord {
  private readonly snapshot: ThreadRecordSnapshot;

  constructor(snapshot: ThreadRecordSnapshot) {
    this.snapshot = cloneThreadRecordSnapshot(snapshot);
  }

  static fromSnapshot(snapshot: ThreadRecordSnapshot): ThreadRecord {
    return new ThreadRecord(snapshot);
  }

  isArchived(): boolean {
    return this.snapshot.deletedAt !== null;
  }

  canBeArchived(): boolean {
    return (
      this.snapshot.messages.length > 0 || this.snapshot.skillSelections.length > 0
    );
  }

  toSnapshot(): ThreadRecordSnapshot {
    return cloneThreadRecordSnapshot(this.snapshot);
  }
}

function cloneThreadRecordSnapshot(snapshot: ThreadRecordSnapshot): ThreadRecordSnapshot {
  return {
    ...snapshot,
    threadEnvironment: { ...snapshot.threadEnvironment },
    instructionContextToggles: { ...snapshot.instructionContextToggles },
    instruction: snapshot.instruction ? { ...snapshot.instruction } : null,
    messages: snapshot.messages.map((message) => ({
      ...message,
      attachments: message.attachments.map((attachment) => ({ ...attachment })),
      skillActivations: message.skillActivations.map((activation) => ({
        ...activation,
        skillProfile: { ...activation.skillProfile },
      })),
    })),
    mcpServers: snapshot.mcpServers.map((server) =>
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
    ),
    mcpRpcLogs: snapshot.mcpRpcLogs.map((entry) => ({
      ...entry,
      request: cloneJsonCompatibleValue(entry.request),
      response: cloneJsonCompatibleValue(entry.response),
    })),
    skillSelections: snapshot.skillSelections.map((selection) => ({
      ...selection,
      skillProfile: { ...selection.skillProfile },
    })),
  };
}

function cloneJsonCompatibleValue<T>(value: T): T {
  if (
    value === null ||
    value === undefined ||
    typeof value !== "object"
  ) {
    return value;
  }

  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}
