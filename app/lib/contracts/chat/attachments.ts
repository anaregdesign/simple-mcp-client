export type ChatAttachment = {
  name: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
};

export type DraftChatAttachment = ChatAttachment & {
  id: string;
};
