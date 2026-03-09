import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";

export type ThreadAttachment = {
  name: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
};

export type ThreadSkillActivation = {
  name: string;
  location: string;
};

export type ThreadMessageRole = "user" | "assistant";

export type ThreadMessage = {
  id: string;
  role: ThreadMessageRole;
  content: string;
  createdAt: string;
  turnId: string;
  attachments: ThreadAttachment[];
  skillActivations: ThreadSkillActivation[];
};

export type ThreadOperationLogEntry = {
  id: string;
  sequence: number;
  operationType: "mcp" | "skill";
  serverName: string;
  method: string;
  startedAt: string;
  completedAt: string;
  request: unknown;
  response: unknown;
  isError: boolean;
  turnId: string;
};

export type ThreadMcpHttpServerConfig = {
  id: string;
  name: string;
  connectOnThreadCreate?: boolean;
  transport: "streamable_http" | "sse";
  url: string;
  headers: Record<string, string>;
  useAzureAuth: boolean;
  azureAuthScope: string;
  timeoutSeconds: number;
};

export type ThreadMcpStdioServerConfig = {
  id: string;
  name: string;
  connectOnThreadCreate?: boolean;
  transport: "stdio";
  command: string;
  args: string[];
  cwd?: string;
  env: Record<string, string>;
};

export type ThreadMcpServerConfig =
  | ThreadMcpHttpServerConfig
  | ThreadMcpStdioServerConfig;

export type ThreadEnvironment = Record<string, string>;

export type ThreadInstructionContextToggles = {
  system: boolean;
};

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
  mcpServers: ThreadMcpServerConfig[];
  mcpRpcLogs: ThreadOperationLogEntry[];
  skillSelections: ThreadSkillActivation[];
};

export type ThreadSkillProfileRecord = {
  id: number;
  userId: number;
  registryProfileId: number | null;
  name: string;
  location: string;
  source: string;
};

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
  role: string;
  content: string;
  createdAt: string;
  turnId: string;
  attachmentsJson: string;
  skillActivations: ThreadMessageSkillActivationRecord[];
};

export type ThreadMcpServerRecord = {
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

export type ThreadOperationLogRecord = {
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
  reasoningEffort: string;
  webSearchEnabled: boolean;
  threadEnvironmentJson: string;
  instructionContextTogglesJson: string;
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
    return this.snapshot.messages.length > 0 || this.snapshot.skillSelections.length > 0;
  }

  toSnapshot(): ThreadRecordSnapshot {
    return cloneThreadRecordSnapshot(this.snapshot);
  }
}

function cloneThreadRecordSnapshot(snapshot: ThreadRecordSnapshot): ThreadRecordSnapshot {
  return {
    ...snapshot,
    instruction: snapshot.instruction ? { ...snapshot.instruction } : null,
    messages: snapshot.messages.map((message) => ({
      ...message,
      skillActivations: message.skillActivations.map((activation) => ({
        ...activation,
        skillProfile: { ...activation.skillProfile },
      })),
    })),
    mcpServers: snapshot.mcpServers.map((server) => ({ ...server })),
    mcpRpcLogs: snapshot.mcpRpcLogs.map((entry) => ({ ...entry })),
    skillSelections: snapshot.skillSelections.map((selection) => ({
      ...selection,
      skillProfile: { ...selection.skillProfile },
    })),
  };
}
