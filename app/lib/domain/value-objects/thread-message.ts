import {
  cloneThreadAttachments,
  type ThreadAttachment,
} from "~/lib/domain/value-objects/thread-attachment";
import {
  cloneThreadMessageSkillActivations,
  type ThreadMessageSkillActivation,
} from "~/lib/domain/value-objects/thread-skill";

export type ThreadMessageRole = "user" | "assistant";

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

export function cloneThreadMessage(message: ThreadMessage): ThreadMessage {
  return {
    ...message,
    attachments: cloneThreadAttachments(message.attachments),
    skillActivations: cloneThreadMessageSkillActivations(
      message.skillActivations,
    ),
  };
}

export function cloneThreadMessages(messages: ThreadMessage[]): ThreadMessage[] {
  return messages.map(cloneThreadMessage);
}
