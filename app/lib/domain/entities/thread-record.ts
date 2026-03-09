import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";

type ThreadAttachment = {
  name: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
};

type ThreadSkillActivation = {
  name: string;
  location: string;
};

type ThreadMessageRole = "user" | "assistant";

type ThreadMessage = {
  id: string;
  role: ThreadMessageRole;
  content: string;
  createdAt: string;
  turnId: string;
  attachments: ThreadAttachment[];
  skillActivations: ThreadSkillActivation[];
};

type ThreadOperationLogEntry = {
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

type ThreadMcpHttpServerConfig = {
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

type ThreadMcpStdioServerConfig = {
  id: string;
  name: string;
  connectOnThreadCreate?: boolean;
  transport: "stdio";
  command: string;
  args: string[];
  cwd?: string;
  env: Record<string, string>;
};

type ThreadMcpServerConfig =
  | ThreadMcpHttpServerConfig
  | ThreadMcpStdioServerConfig;

type ThreadEnvironment = Record<string, string>;

type ThreadInstructionContextToggles = {
  system: boolean;
};

type ThreadWritePayload = {
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
  role: ThreadMessageRole;
  content: string;
  createdAt: string;
  turnId: string;
  attachments: ThreadAttachment[];
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

  get id(): string {
    return this.snapshot.id;
  }

  get userId(): number {
    return this.snapshot.userId;
  }

  get name(): string {
    return this.snapshot.name;
  }

  get createdAt(): string {
    return this.snapshot.createdAt;
  }

  get updatedAt(): string {
    return this.snapshot.updatedAt;
  }

  get deletedAt(): string | null {
    return this.snapshot.deletedAt;
  }

  get reasoningEffort(): ReasoningEffort {
    return this.snapshot.reasoningEffort;
  }

  get webSearchEnabled(): boolean {
    return this.snapshot.webSearchEnabled;
  }

  get threadEnvironment(): ThreadEnvironment {
    return { ...this.snapshot.threadEnvironment };
  }

  get instructionContextToggles(): ThreadInstructionContextToggles {
    return {
      ...this.snapshot.instructionContextToggles,
    };
  }

  get instruction(): ThreadInstructionRecord | null {
    return this.snapshot.instruction ? { ...this.snapshot.instruction } : null;
  }

  get messages(): ThreadMessageRecord[] {
    return cloneThreadMessages(this.snapshot.messages);
  }

  get mcpServers(): ThreadMcpServerRecord[] {
    return cloneThreadMcpServers(this.snapshot.mcpServers);
  }

  get mcpRpcLogs(): ThreadOperationLogRecord[] {
    return cloneThreadOperationLogs(this.snapshot.mcpRpcLogs);
  }

  get skillSelections(): ThreadSkillActivationRecord[] {
    return cloneThreadSkillSelections(this.snapshot.skillSelections);
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
    messages: cloneThreadMessages(snapshot.messages),
    mcpServers: cloneThreadMcpServers(snapshot.mcpServers),
    mcpRpcLogs: cloneThreadOperationLogs(snapshot.mcpRpcLogs),
    skillSelections: cloneThreadSkillSelections(snapshot.skillSelections),
  };
}

function cloneThreadMessages(messages: ThreadMessageRecord[]): ThreadMessageRecord[] {
  return messages.map((message) => ({
    ...message,
    attachments: message.attachments.map((attachment) => ({ ...attachment })),
    skillActivations: message.skillActivations.map((activation) => ({
      ...activation,
      skillProfile: { ...activation.skillProfile },
    })),
  }));
}

function cloneThreadMcpServers(
  servers: ThreadMcpServerRecord[],
): ThreadMcpServerRecord[] {
  return servers.map((server) =>
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

function cloneThreadOperationLogs(
  entries: ThreadOperationLogRecord[],
): ThreadOperationLogRecord[] {
  return entries.map((entry) => ({
    ...entry,
    request: cloneJsonCompatibleValue(entry.request),
    response: cloneJsonCompatibleValue(entry.response),
  }));
}

function cloneThreadSkillSelections(
  selections: ThreadSkillActivationRecord[],
): ThreadSkillActivationRecord[] {
  return selections.map((selection) => ({
    ...selection,
    skillProfile: { ...selection.skillProfile },
  }));
}

function cloneJsonCompatibleValue<T>(value: T): T {
  if (value === null || value === undefined || typeof value !== "object") {
    return value;
  }

  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}
