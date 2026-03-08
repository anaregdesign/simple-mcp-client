import { describe, expect, it } from "vitest";
import { ThreadMessage } from "~/lib/domain/threads/thread-message";

describe("ThreadMessage", () => {
  it("normalizes attachments and keeps role invariants", () => {
    const message = new ThreadMessage({
      id: " message-1 ",
      role: "assistant",
      content: "Hello",
      createdAt: "2026-03-09T00:00:00.000Z",
      turnId: " turn-1 ",
      attachments: [
        {
          name: "demo.txt",
          mimeType: "text/plain",
          sizeBytes: 4,
          dataUrl: "data:text/plain;base64,ZGVtbw==",
        },
      ],
      skillActivations: [],
    });

    expect(message.id).toBe("message-1");
    expect(message.turnId).toBe("turn-1");
    expect(message.isUser()).toBe(false);
    expect(message.toSnapshot().attachments).toHaveLength(1);
  });

  it("rejects invalid roles", () => {
    expect(
      () =>
        new ThreadMessage({
          id: "message-2",
          role: "system" as never,
          content: "",
          createdAt: "2026-03-09T00:00:00.000Z",
          turnId: "turn-2",
          attachments: [],
          skillActivations: [],
        }),
    ).toThrow("ThreadMessage role is invalid.");
  });
});
