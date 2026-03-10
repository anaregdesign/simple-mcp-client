/**
 * Test module verifying title behavior.
 */
import { describe, expect, it } from "vitest";
import {
  buildThreadAutoTitlePlaygroundContent,
  buildThreadAutoTitleRequestMessage,
} from "~/lib/contracts/threads/title";

describe("buildThreadAutoTitlePlaygroundContent", () => {
  it("includes recent messages with role labels", () => {
    const content = buildThreadAutoTitlePlaygroundContent([
      {
        id: "m-1",
        role: "user",
        content: "Draft a rollout plan",
        createdAt: "2026-03-01T00:00:00.000Z",
        turnId: "t-1",
        attachments: [],
        skillActivations: [],
      },
      {
        id: "m-2",
        role: "assistant",
        content: "I can help with milestones.",
        createdAt: "2026-03-01T00:00:01.000Z",
        turnId: "t-1",
        attachments: [],
        skillActivations: [],
      },
    ]);

    expect(content).toBe("User: Draft a rollout plan\nAssistant: I can help with milestones.");
  });
});

describe("buildThreadAutoTitleRequestMessage", () => {
  it("embeds both playground content and instruction", () => {
    const message = buildThreadAutoTitleRequestMessage({
      playgroundContent: "User: Build release checklist",
      instruction: "Answer in Japanese.",
    });

    expect(message).toContain("User: Build release checklist");
    expect(message).toContain("Answer in Japanese.");
    expect(message).toContain('"useInstruction":true');
  });
});
