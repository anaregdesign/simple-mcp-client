export type ThreadAttachment = {
  name: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
};

export function cloneThreadAttachment(
  attachment: ThreadAttachment,
): ThreadAttachment {
  return {
    ...attachment,
  };
}

export function cloneThreadAttachments(
  attachments: ThreadAttachment[],
): ThreadAttachment[] {
  return attachments.map(cloneThreadAttachment);
}
