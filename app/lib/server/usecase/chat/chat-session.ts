import {
  MemorySession,
  assistant,
  user,
  type AgentInputItem,
  type Session,
} from "@openai/agents-core";

export type ChatSessionAttachment = {
  name: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
};

export type ChatSessionHistoryMessage = {
  role: "user" | "assistant";
  content: string;
  attachments: ChatSessionAttachment[];
};

export function createChatMemorySession(options: {
  sessionId?: string | null;
  history: ChatSessionHistoryMessage[];
  useCodeInterpreter: boolean;
}): Session {
  return new MemorySession({
    ...(options.sessionId ? { sessionId: options.sessionId } : {}),
    initialItems: buildChatSessionHistoryItems(
      options.history,
      options.useCodeInterpreter,
    ),
  });
}

export function buildChatSessionHistoryItems(
  history: ChatSessionHistoryMessage[],
  useCodeInterpreter: boolean,
): AgentInputItem[] {
  return history.flatMap((entry) => {
    if (entry.role === "assistant") {
      return [assistant(entry.content)];
    }

    return [
      buildUserMessageInput(entry.content, entry.attachments, {
        useCodeInterpreter,
      }),
    ];
  });
}

export function buildUserMessageInput(
  content: string,
  attachments: ChatSessionAttachment[],
  options: {
    useCodeInterpreter: boolean;
  },
): AgentInputItem {
  if (attachments.length === 0) {
    return user(content);
  }

  const pdfAttachments = attachments.filter(
    (attachment) => readFileExtension(attachment.name) === "pdf",
  );
  const codeInterpreterAttachmentNames = attachments
    .filter((attachment) => readFileExtension(attachment.name) !== "pdf")
    .filter(() => options.useCodeInterpreter)
    .map((attachment) => attachment.name);

  if (
    pdfAttachments.length === 0 &&
    codeInterpreterAttachmentNames.length === 0
  ) {
    return user(content);
  }

  const textWithAttachmentHint =
    codeInterpreterAttachmentNames.length > 0
      ? [
          content,
          "",
          "Files available in Code Interpreter:",
          ...codeInterpreterAttachmentNames.map((name) => `- ${name}`),
        ].join("\n")
      : content;

  const inputContent = [
    {
      type: "input_text" as const,
      text: textWithAttachmentHint,
    },
    ...pdfAttachments.map((attachment) => ({
      type: "input_file" as const,
      file: attachment.dataUrl,
      filename: attachment.name,
    })),
  ];
  return user(inputContent);
}

function readFileExtension(fileName: string): string {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}
