/**
 * Test module verifying messages behavior.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChatAttachment } from "~/lib/contracts/chat/attachments";
import { createThreadMessage } from "./messages";

describe("createThreadMessage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a message with deterministic prefix fields", () => {
    vi.spyOn(Date, "now").mockReturnValue(1700000000000);
    vi.spyOn(Math, "random").mockReturnValue(0.123456789);

    const message = createThreadMessage(
      "user",
      "hello",
      "turn-1",
      [],
      [],
      "2026-03-01T00:00:00.000Z",
    );

    expect(message.role).toBe("user");
    expect(message.content).toBe("hello");
    expect(message.createdAt).toBe("2026-03-01T00:00:00.000Z");
    expect(message.turnId).toBe("turn-1");
    expect(message.skillActivations).toEqual([]);
    expect(message.id.startsWith("user-1700000000000-")).toBe(true);
  });

  it("clones attachment inputs defensively", () => {
    const attachments: ChatAttachment[] = [
      {
        name: "spec.pdf",
        mimeType: "application/pdf",
        sizeBytes: 42,
        dataUrl: "data:application/pdf;base64,abc",
      },
    ];

    const message = createThreadMessage("user", "hello", "turn-1", attachments);

    expect(message.attachments).toEqual(attachments);
    expect(message.attachments).not.toBe(attachments);
    expect(message.attachments[0]).not.toBe(attachments[0]);
  });
});
