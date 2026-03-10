import {
  readChatAttachmentListFromUnknown,
  type ChatAttachment,
} from "~/lib/contracts/chat/attachments";
import { readThreadSkillActivationList } from "~/lib/contracts/skills/parsers";
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

export function readThreadMessageFromUnknown(value: unknown): ThreadMessage | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readTrimmedString(value.id);
  const createdAt = readTrimmedString(value.createdAt);
  const turnId = readTrimmedString(value.turnId);
  const role = value.role;
  const content = typeof value.content === "string" ? value.content : "";
  if (!id || !createdAt || !turnId || (role !== "user" && role !== "assistant")) {
    return null;
  }

  return {
    id,
    role,
    content,
    createdAt,
    turnId,
    attachments: readChatAttachmentListFromUnknown(value.attachments),
    skillActivations: readThreadSkillActivationList(value.skillActivations),
  };
}

function readTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
