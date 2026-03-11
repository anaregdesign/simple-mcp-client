import { describe, expect, it } from "vitest";
import {
  cloneThreadMessage,
  cloneThreadMessages,
} from "~/lib/domain/value-objects/thread-message";

function createThreadMessage() {
  return {
    id: "message-a",
    threadId: "thread-a",
    conversationOrder: 0,
    role: "user" as const,
    content: "hello",
    createdAt: "2026-01-01T00:00:00.000Z",
    turnId: "turn-a",
    attachments: [
      {
        name: "notes.txt",
        mimeType: "text/plain",
        sizeBytes: 5,
        dataUrl: "data:text/plain;base64,aGVsbG8=",
      },
    ],
    skillActivations: [
      {
        id: "activation-a",
        messageId: "message-a",
        selectionOrder: 0,
        skillProfileId: 1,
        skillProfile: {
          id: 1,
          userId: 42,
          registryProfileId: null,
          name: "skill-a",
          location: "/tmp/skill-a",
          source: "workspace",
        },
      },
    ],
  };
}

describe("thread-message", () => {
  it("clones nested attachments and skill activations", () => {
    const message = createThreadMessage();
    const cloned = cloneThreadMessage(message);

    cloned.attachments[0]!.name = "updated.txt";
    cloned.skillActivations[0]!.skillProfile.name = "updated-skill";

    expect(message.attachments[0]!.name).toBe("notes.txt");
    expect(message.skillActivations[0]!.skillProfile.name).toBe("skill-a");
  });

  it("clones message collections defensively", () => {
    const messages = [createThreadMessage()];
    const cloned = cloneThreadMessages(messages);

    expect(cloned[0]).not.toBe(messages[0]);
  });
});
