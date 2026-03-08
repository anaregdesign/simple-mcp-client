import type { ChatAttachment } from "~/lib/contracts/chat/attachments";
import type {
  ThreadMessage as ThreadMessageSnapshot,
  ThreadMessageRole,
} from "~/lib/contracts/chat/messages";
import type { ThreadSkillActivation } from "~/lib/contracts/skills/types";
import { DomainError } from "~/lib/domain/shared/domain-error";

export class ThreadMessage {
  readonly id: string;
  readonly role: ThreadMessageRole;
  readonly content: string;
  readonly createdAt: string;
  readonly turnId: string;
  readonly attachments: ChatAttachment[];
  readonly skillActivations: ThreadSkillActivation[];

  constructor(snapshot: ThreadMessageSnapshot) {
    const id = snapshot.id.trim();
    const createdAt = snapshot.createdAt.trim();
    const turnId = snapshot.turnId.trim();

    if (!id) {
      throw new DomainError("thread_message_id_required", "ThreadMessage id is required.");
    }
    if (snapshot.role !== "user" && snapshot.role !== "assistant") {
      throw new DomainError("thread_message_role_invalid", "ThreadMessage role is invalid.");
    }
    if (!createdAt) {
      throw new DomainError(
        "thread_message_created_at_required",
        "ThreadMessage createdAt is required.",
      );
    }
    if (!turnId) {
      throw new DomainError(
        "thread_message_turn_id_required",
        "ThreadMessage turnId is required.",
      );
    }

    this.id = id;
    this.role = snapshot.role;
    this.content = snapshot.content;
    this.createdAt = createdAt;
    this.turnId = turnId;
    this.attachments = snapshot.attachments.map(cloneAttachment);
    this.skillActivations = snapshot.skillActivations.map((activation) => ({
      ...activation,
    }));
  }

  static fromSnapshot(snapshot: ThreadMessageSnapshot): ThreadMessage {
    return new ThreadMessage(snapshot);
  }

  isUser(): boolean {
    return this.role === "user";
  }

  toSnapshot(): ThreadMessageSnapshot {
    return {
      id: this.id,
      role: this.role,
      content: this.content,
      createdAt: this.createdAt,
      turnId: this.turnId,
      attachments: this.attachments.map(cloneAttachment),
      skillActivations: this.skillActivations.map((activation) => ({ ...activation })),
    };
  }

  toJSON(): ThreadMessageSnapshot {
    return this.toSnapshot();
  }
}

function cloneAttachment(attachment: ChatAttachment): ChatAttachment {
  return {
    ...attachment,
  };
}
