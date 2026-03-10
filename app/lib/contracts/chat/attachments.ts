export type ChatAttachment = {
  name: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
};

export type DraftChatAttachment = ChatAttachment & {
  id: string;
};

export function cloneChatAttachment(attachment: ChatAttachment): ChatAttachment {
  return {
    ...attachment,
  };
}

export function cloneChatAttachments(attachments: ChatAttachment[]): ChatAttachment[] {
  return attachments.map(cloneChatAttachment);
}

export function readChatAttachmentFromUnknown(value: unknown): ChatAttachment | null {
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

export function readChatAttachmentListFromUnknown(value: unknown): ChatAttachment[] {
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

function readTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
