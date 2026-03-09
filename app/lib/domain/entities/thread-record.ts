import {
  DEFAULT_REASONING_EFFORT,
  DEFAULT_WEB_SEARCH_ENABLED,
} from "~/lib/constants/chat";
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

export const DEFAULT_THREAD_INSTRUCTION_CONTEXT_TOGGLES: ThreadInstructionContextToggles =
  {
    system: true,
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

export function cloneThreadEnvironment(value: ThreadEnvironment): ThreadEnvironment {
  return { ...value };
}

export function cloneThreadInstructionContextToggles(
  value: ThreadInstructionContextToggles,
): ThreadInstructionContextToggles {
  return {
    system: value.system === true,
  };
}

export function hasNonDefaultThreadInstructionContextToggles(
  value: ThreadInstructionContextToggles,
): boolean {
  return value.system !== DEFAULT_THREAD_INSTRUCTION_CONTEXT_TOGGLES.system;
}

export function hasThreadInteraction(
  snapshot: Pick<ThreadWritePayload, "messages"> &
    Partial<Pick<ThreadWritePayload, "skillSelections">>,
): boolean {
  if (snapshot.messages.length > 0) {
    return true;
  }

  return (snapshot.skillSelections?.length ?? 0) > 0;
}

export function hasThreadPersistableState(
  snapshot: Pick<
    ThreadWritePayload,
    | "messages"
    | "reasoningEffort"
    | "webSearchEnabled"
    | "instructionContextToggles"
    | "threadEnvironment"
  > &
    Partial<Pick<ThreadWritePayload, "skillSelections">>,
): boolean {
  if (hasThreadInteraction(snapshot)) {
    return true;
  }

  return (
    snapshot.reasoningEffort !== DEFAULT_REASONING_EFFORT ||
    snapshot.webSearchEnabled !== DEFAULT_WEB_SEARCH_ENABLED ||
    hasNonDefaultThreadInstructionContextToggles(
      snapshot.instructionContextToggles,
    ) ||
    Object.keys(snapshot.threadEnvironment).length > 0
  );
}

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
  if (value === null || value === undefined || typeof value !== "object") {
    return value;
  }

  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}
