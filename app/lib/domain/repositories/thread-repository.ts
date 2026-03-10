import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";
import type { ChatAzureConfig } from "~/lib/domain/value-objects/chat-azure-config";
import type { ThreadEnvironment } from "~/lib/domain/value-objects/thread-environment";
import type { ThreadInstructionContextToggles } from "~/lib/domain/value-objects/thread-instruction-context";
import type { Thread } from "~/lib/domain/entities/thread";
import type { ThreadAttachment } from "~/lib/domain/value-objects/thread-attachment";
import type { ThreadMessageRole } from "~/lib/domain/value-objects/thread-message";
import type { ThreadOperationType } from "~/lib/domain/value-objects/thread-operation-log";
import type { ThreadSkillReference } from "~/lib/domain/value-objects/thread-skill";

export type ThreadLifecycleState = {
  deletedAt: string | null;
};

export type ThreadSaveMessage = {
  id: string;
  role: ThreadMessageRole;
  content: string;
  createdAt: string;
  turnId: string;
  attachments: ThreadAttachment[];
  skillActivations: ThreadSkillReference[];
};

export type ThreadSaveMcpHttpServer = {
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

export type ThreadSaveMcpStdioServer = {
  id: string;
  name: string;
  connectOnThreadCreate?: boolean;
  transport: "stdio";
  command: string;
  args: string[];
  cwd?: string;
  env: ThreadEnvironment;
};

export type ThreadSaveMcpServer =
  | ThreadSaveMcpHttpServer
  | ThreadSaveMcpStdioServer;

export type ThreadSaveOperationLog = {
  id: string;
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

export type ThreadSaveInput = {
  id: string;
  name: string;
  createdAt: string;
  reasoningEffort: ReasoningEffort;
  webSearchEnabled: boolean;
  chatAzureConfig: ChatAzureConfig | null;
  agentConversationId?: string | null;
  instructionContent: string;
  instructionContextToggles: ThreadInstructionContextToggles;
  threadEnvironment: ThreadEnvironment;
  messages: ThreadSaveMessage[];
  mcpServers: ThreadSaveMcpServer[];
  operationLogs: ThreadSaveOperationLog[];
  skillSelections: ThreadSkillReference[];
};

export interface ThreadRepository {
  listByUserId(userId: number): Promise<Thread[]>;
  findByIdForUser(userId: number, threadId: string): Promise<Thread | null>;
  readLifecycleState(
    userId: number,
    threadId: string,
  ): Promise<ThreadLifecycleState | null>;
  save(
    userId: number,
    payload: ThreadSaveInput,
  ): Promise<{ thread: Thread; created: boolean } | null>;
  setDeletedAt(
    userId: number,
    threadId: string,
    deletedAt: string | null,
  ): Promise<Thread | null>;
}
