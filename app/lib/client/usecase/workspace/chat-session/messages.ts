/**
 * Client runtime support module.
 */
import {
  cloneChatAttachments,
  type ChatAttachment,
} from "~/lib/contracts/chat/attachments";
import type {
  ThreadMessage,
  ThreadMessageRole,
} from "~/lib/contracts/chat/messages";
import type { ThreadSkillActivation } from "~/lib/contracts/skills/types";

export type { ThreadMessage, ThreadMessageRole };

export function createThreadMessage(
  role: ThreadMessageRole,
  content: string,
  turnId: string,
  attachments: ChatAttachment[] = [],
  skillActivations: ThreadSkillActivation[] = [],
  createdAt: string = new Date().toISOString(),
): ThreadMessage {
  const randomPart = Math.random().toString(36).slice(2);
  const normalizedCreatedAt = typeof createdAt === "string" && createdAt.trim()
    ? createdAt.trim()
    : new Date().toISOString();
  return {
    id: `${role}-${Date.now()}-${randomPart}`,
    role,
    content,
    createdAt: normalizedCreatedAt,
    turnId,
    attachments: cloneChatAttachments(attachments),
    skillActivations: skillActivations.map((selection) => ({ ...selection })),
  };
}
