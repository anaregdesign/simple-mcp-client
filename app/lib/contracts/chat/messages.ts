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

export function cloneThreadMessage(message: ThreadMessage): ThreadMessage {
  return {
    ...message,
    attachments: message.attachments.map((attachment) => ({ ...attachment })),
    skillActivations: message.skillActivations.map((activation) => ({
      ...activation,
    })),
  };
}

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
    attachments: readChatAttachmentList(value.attachments),
    skillActivations: readThreadSkillActivationList(value.skillActivations),
  };
}

function readChatAttachmentList(value: unknown): ChatAttachment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const attachments: ChatAttachment[] = [];
  for (const entry of value) {
    const attachment = readChatAttachmentFromUnknown(entry);
    if (!attachment) {
      continue;
    }
    attachments.push(attachment);
  }

  return attachments;
}

function readChatAttachmentFromUnknown(value: unknown): ChatAttachment | null {
  if (!isRecord(value)) {
    return null;
  }

  const name = readTrimmedString(value.name);
  const mimeType = readTrimmedString(value.mimeType);
  const dataUrl = readTrimmedString(value.dataUrl);
  const sizeBytes =
    typeof value.sizeBytes === "number" && Number.isFinite(value.sizeBytes)
      ? value.sizeBytes
      : Number.NaN;
  if (!name || !mimeType || !dataUrl || !Number.isFinite(sizeBytes) || sizeBytes < 0) {
    return null;
  }

  return {
    name,
    mimeType,
    sizeBytes,
    dataUrl,
  };
}

function readThreadSkillActivationList(value: unknown): ThreadSkillActivation[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const activations: ThreadSkillActivation[] = [];
  for (const entry of value) {
    const activation = readThreadSkillActivationFromUnknown(entry);
    if (!activation) {
      continue;
    }
    activations.push(activation);
  }

  return activations;
}

function readThreadSkillActivationFromUnknown(
  value: unknown,
): ThreadSkillActivation | null {
  if (!isRecord(value)) {
    return null;
  }

  const name = readTrimmedString(value.name);
  const location = readTrimmedString(value.location);
  if (!name || !location) {
    return null;
  }

  return {
    name,
    location,
  };
}

function readTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
