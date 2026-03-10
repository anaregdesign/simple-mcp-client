import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";
import { DomainError } from "~/lib/domain/entities/domain-error";
import {
  cloneChatAzureConfig,
  type ChatAzureConfig,
} from "~/lib/domain/value-objects/chat-azure-config";
import {
  cloneThreadSnapshot,
  type ThreadSnapshot,
} from "~/lib/domain/value-objects/thread-snapshot";
import {
  cloneThreadEnvironment,
  type ThreadEnvironment,
} from "~/lib/domain/value-objects/thread-environment";
import {
  cloneThreadInstructionContextToggles,
  type ThreadInstructionContextToggles,
} from "~/lib/domain/value-objects/thread-instruction-context";
import {
  cloneThreadInstruction,
  type ThreadInstruction,
} from "~/lib/domain/value-objects/thread-instruction";
import {
  cloneThreadMessages,
  type ThreadMessage,
} from "~/lib/domain/value-objects/thread-message";
import {
  cloneThreadMcpServers,
  type ThreadMcpServer,
} from "~/lib/domain/value-objects/thread-mcp-server";
import {
  cloneThreadOperationLogs,
  type ThreadOperationLog,
} from "~/lib/domain/value-objects/thread-operation-log";
import {
  cloneThreadSkillSelections,
  type ThreadSkillSelection,
} from "~/lib/domain/value-objects/thread-skill";

export class Thread {
  private readonly props: ThreadSnapshot;

  constructor(props: ThreadSnapshot) {
    this.props = cloneThreadSnapshot(props);
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
    return cloneThreadEnvironment(this.props.threadEnvironment);
  }

  get instructionContextToggles(): ThreadInstructionContextToggles {
    return cloneThreadInstructionContextToggles(
      this.props.instructionContextToggles,
    );
  }

  get instruction(): ThreadInstruction | null {
    return cloneThreadInstruction(this.props.instruction);
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
