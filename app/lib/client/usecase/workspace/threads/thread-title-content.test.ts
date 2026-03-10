import { describe, expect, it } from "vitest";
import { buildThreadAutoTitlePlaygroundContent } from "~/lib/client/usecase/workspace/threads/thread-title-content";

describe("thread-title-content", () => {
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
