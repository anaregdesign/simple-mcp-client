import type { ThreadMessage } from "~/lib/contracts/chat/messages";
import type { ThreadOperationLogEntry } from "~/lib/contracts/chat/operation-log";
import type { McpServerConfig } from "~/lib/contracts/mcp/profile";
import type { ThreadSkillActivation } from "~/lib/contracts/skills/types";
import type { ThreadEnvironment } from "~/lib/contracts/threads/environment";
import type { ThreadInstructionContextToggles } from "~/lib/contracts/threads/instruction-context";
import type { ThreadSnapshot } from "~/lib/contracts/threads/types";
import { DomainError } from "~/lib/domain/shared/domain-error";

export class Thread {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
  readonly reasoningEffort: ThreadSnapshot["reasoningEffort"];
  readonly webSearchEnabled: boolean;
  readonly agentInstruction: string;
  readonly instructionContextToggles: ThreadInstructionContextToggles;
  readonly threadEnvironment: ThreadEnvironment;
  readonly messages: ThreadMessage[];
  readonly mcpServers: McpServerConfig[];
  readonly mcpRpcLogs: ThreadOperationLogEntry[];
  readonly skillSelections: ThreadSkillActivation[];

  constructor(snapshot: ThreadSnapshot) {
    const id = snapshot.id.trim();
    const name = snapshot.name.trim();
    const createdAt = snapshot.createdAt.trim();
    const updatedAt = snapshot.updatedAt.trim();
    const deletedAt =
      typeof snapshot.deletedAt === "string" && snapshot.deletedAt.trim()
        ? snapshot.deletedAt.trim()
        : null;

    if (!id) {
      throw new DomainError("thread_id_required", "Thread id is required.");
    }
    if (!name) {
      throw new DomainError("thread_name_required", "Thread name is required.");
    }
    if (!createdAt) {
      throw new DomainError("thread_created_at_required", "Thread createdAt is required.");
    }
    if (!updatedAt) {
      throw new DomainError("thread_updated_at_required", "Thread updatedAt is required.");
    }

    this.id = id;
    this.name = name;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.deletedAt = deletedAt;
    this.reasoningEffort = snapshot.reasoningEffort;
    this.webSearchEnabled = snapshot.webSearchEnabled === true;
    this.agentInstruction = snapshot.agentInstruction;
    this.instructionContextToggles = { ...snapshot.instructionContextToggles };
    this.threadEnvironment = { ...snapshot.threadEnvironment };
    this.messages = [...snapshot.messages];
    this.mcpServers = [...snapshot.mcpServers];
    this.mcpRpcLogs = [...snapshot.mcpRpcLogs];
    this.skillSelections = [...snapshot.skillSelections];
  }

  static fromSnapshot(snapshot: ThreadSnapshot): Thread {
    return new Thread(snapshot);
  }

  isArchived(): boolean {
    return this.deletedAt !== null;
  }

  toSnapshot(): ThreadSnapshot {
    return {
      id: this.id,
      name: this.name,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      deletedAt: this.deletedAt,
      reasoningEffort: this.reasoningEffort,
      webSearchEnabled: this.webSearchEnabled,
      agentInstruction: this.agentInstruction,
      instructionContextToggles: { ...this.instructionContextToggles },
      threadEnvironment: { ...this.threadEnvironment },
      messages: [...this.messages],
      mcpServers: [...this.mcpServers],
      mcpRpcLogs: [...this.mcpRpcLogs],
      skillSelections: [...this.skillSelections],
    };
  }

  toJSON(): ThreadSnapshot {
    return this.toSnapshot();
  }
}
