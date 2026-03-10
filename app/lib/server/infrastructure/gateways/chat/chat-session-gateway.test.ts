import { describe, expect, it } from "vitest";
import {
  buildChatSessionHistoryItems,
  createChatConversationSession,
  createChatUserMessageInput,
} from "~/lib/server/infrastructure/gateways/chat/chat-session-gateway";

describe("chat-session-gateway", () => {
  it("builds user input with code-interpreter hints and PDF file items", () => {
    expect(
      createChatUserMessageInput(
        "Analyze these files.",
        [
          {
            name: "notes.pdf",
            mimeType: "application/pdf",
            sizeBytes: 10,
            dataUrl: "data:application/pdf;base64,JVBERi0xLjQK",
          },
          {
            name: "sheet.csv",
            mimeType: "text/csv",
            sizeBytes: 5,
            dataUrl: "data:text/csv;base64,YQpi",
          },
        ],
        {
          useCodeInterpreter: true,
        },
      ),
    ).toMatchObject({
      role: "user",
      content: [
        {
          type: "input_text",
          text: expect.stringContaining("Files available in Code Interpreter:"),
        },
        {
          type: "input_file",
          filename: "notes.pdf",
        },
      ],
    });
  });

  it("hydrates a memory session from thread history", async () => {
    const session = createChatConversationSession({
      sessionId: "session-1",
      history: [
        {
          role: "user",
          content: "Hello",
          attachments: [],
        },
        {
          role: "assistant",
          content: "Hi there",
          attachments: [],
        },
      ],
      useCodeInterpreter: false,
    });

    await expect(session.getSessionId()).resolves.toBe("session-1");
    await expect(
      (
        session as unknown as {
          getItems: () => Promise<unknown[]>;
        }
      ).getItems(),
    ).resolves.toEqual(
      buildChatSessionHistoryItems(
        [
          {
            role: "user",
            content: "Hello",
            attachments: [],
          },
          {
            role: "assistant",
            content: "Hi there",
            attachments: [],
          },
        ],
        false,
      ),
    );
  });
});
