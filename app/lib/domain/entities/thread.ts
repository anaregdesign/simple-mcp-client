import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";
import { DomainError } from "~/lib/domain/entities/domain-error";
import {
  cloneChatAzureConfig,
  type ChatAzureConfig,
} from "~/lib/domain/value-objects/chat-azure-config";

export type ThreadAttachment = {
  name: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
};

export type ThreadSkillReference = {
  name: string;
  location: string;
};

export type ThreadMessageRole = "user" | "assistant";

export type ThreadOperationType = "mcp" | "skill";

export type ThreadEnvironment = Record<string, string>;

export type ThreadInstructionContextToggles = {
  system: boolean;
};

export type ThreadSkillProfile = {
  id: number;
  userId: number;
  registryProfileId: number | null;
  name: string;
  location: string;
  source: string;
};

export type ThreadInstruction = {
  id: number;
  threadId: string;
  content: string;
};

export type ThreadMessageSkillActivation = {
  id: string;
  messageId: string;
  selectionOrder: number;
  skillProfileId: number;
  skillProfile: ThreadSkillProfile;
};

export type ThreadMessage = {
  id: string;
  threadId: string;
  conversationOrder: number;
  role: ThreadMessageRole;
  content: string;
  createdAt: string;
  turnId: string;
  attachments: ThreadAttachment[];
  skillActivations: ThreadMessageSkillActivation[];
};

export type ThreadMcpHttpServer = {
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

export type ThreadMcpStdioServer = {
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

export type ThreadMcpServer = ThreadMcpHttpServer | ThreadMcpStdioServer;

export type ThreadOperationLog = {
  rowId: string;
  sourceRpcId: string;
  threadId: string;
  conversationOrder: number;
  sequence: number;
  operationType: ThreadOperationType;
  serverName: string;
  method: string;
  startedAt: string;
  completedAt: string;
  request: unknown;
  response: unknown;
  isError: boolean;
  turnId: string;
};

export type ThreadSkillSelection = {
  id: string;
  threadId: string;
  selectionOrder: number;
  skillProfileId: number;
  skillProfile: ThreadSkillProfile;
};

export type ThreadProps = {
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

export class Thread {
  private readonly props: ThreadProps;

  constructor(props: ThreadProps) {
    this.props = cloneThreadProps(props);
  }

  get id(): string {
    return this.props.id;
  }

  get userId(): number {
    return this.props.userId;
  }

  get name(): string {
    return this.props.name;
  }

  get createdAt(): string {
    return this.props.createdAt;
  }

  get updatedAt(): string {
    return this.props.updatedAt;
  }

  get deletedAt(): string | null {
    return this.props.deletedAt;
  }

  get reasoningEffort(): ReasoningEffort {
    return this.props.reasoningEffort;
  }

  get webSearchEnabled(): boolean {
    return this.props.webSearchEnabled;
  }

  get chatAzureConfig(): ChatAzureConfig | null {
    return cloneChatAzureConfig(this.props.chatAzureConfig);
  }

  get agentConversationId(): string | null {
    return this.props.agentConversationId ?? null;
  }

  get threadEnvironment(): ThreadEnvironment {
    return { ...this.props.threadEnvironment };
  }

  get instructionContextToggles(): ThreadInstructionContextToggles {
    return {
      ...this.props.instructionContextToggles,
    };
  }

  get instruction(): ThreadInstruction | null {
    return this.props.instruction ? { ...this.props.instruction } : null;
  }

  get messages(): ThreadMessage[] {
    return cloneThreadMessages(this.props.messages);
  }

  get mcpServers(): ThreadMcpServer[] {
    return cloneThreadMcpServers(this.props.mcpServers);
  }

  get operationLogs(): ThreadOperationLog[] {
    return cloneThreadOperationLogs(this.props.operationLogs);
  }

  get skillSelections(): ThreadSkillSelection[] {
    return cloneThreadSkillSelections(this.props.skillSelections);
  }

  isArchived(): boolean {
    return this.props.deletedAt !== null;
  }

  archive(deletedAt: string): Thread {
    const normalizedDeletedAt = deletedAt.trim();
    if (!normalizedDeletedAt) {
      throw new DomainError(
        "thread_deleted_at_required",
        "Thread deletedAt is required to archive a thread.",
      );
    }
    if (this.isArchived()) {
      return this;
    }

    return new Thread({
      ...this.props,
      deletedAt: normalizedDeletedAt,
    });
  }

  restore(): Thread {
    if (!this.isArchived()) {
      return this;
    }

    return new Thread({
      ...this.props,
      deletedAt: null,
    });
  }
}

function cloneThreadProps(props: ThreadProps): ThreadProps {
  return {
    ...props,
    chatAzureConfig: cloneChatAzureConfig(props.chatAzureConfig),
    agentConversationId: props.agentConversationId ?? null,
    threadEnvironment: { ...props.threadEnvironment },
    instructionContextToggles: { ...props.instructionContextToggles },
    instruction: props.instruction ? { ...props.instruction } : null,
    messages: cloneThreadMessages(props.messages),
    mcpServers: cloneThreadMcpServers(props.mcpServers),
    operationLogs: cloneThreadOperationLogs(props.operationLogs),
    skillSelections: cloneThreadSkillSelections(props.skillSelections),
  };
}

function cloneThreadMessages(messages: ThreadMessage[]): ThreadMessage[] {
  return messages.map((message) => ({
    ...message,
    attachments: message.attachments.map((attachment) => ({ ...attachment })),
    skillActivations: message.skillActivations.map((activation) => ({
      ...activation,
      skillProfile: { ...activation.skillProfile },
    })),
  }));
}

function cloneThreadMcpServers(servers: ThreadMcpServer[]): ThreadMcpServer[] {
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

function cloneThreadOperationLogs(entries: ThreadOperationLog[]): ThreadOperationLog[] {
  return entries.map((entry) => ({
    ...entry,
    request: cloneJsonCompatibleValue(entry.request),
    response: cloneJsonCompatibleValue(entry.response),
  }));
}

function cloneThreadSkillSelections(
  selections: ThreadSkillSelection[],
): ThreadSkillSelection[] {
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
