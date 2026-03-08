import type { ChatAttachment } from "~/lib/contracts/chat/attachments";
import type { ThreadSkillActivation } from "~/lib/contracts/skills/types";

export type ThreadMessageRole = "user" | "assistant";

export type ThreadMessage = {
  id: string;
  role: ThreadMessageRole;
  content: string;
  createdAt: string;
  turnId: string;
  attachments: ChatAttachment[];
  skillActivations: ThreadSkillActivation[];
};
