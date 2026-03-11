import { describe, expect, it } from "vitest";
import {
  createAssistantMessage,
  mergeThreadSkillSelections,
} from "~/lib/server/usecase/chat/thread-chat-run-mappers";

describe("mergeThreadSkillSelections", () => {
  it("keeps the first unique location and trims input", () => {
    expect(
      mergeThreadSkillSelections(
        [
          { name: "alpha", location: " /skills/alpha " },
          { name: "duplicate-thread", location: "/skills/alpha" },
        ],
        [
          { name: "beta", location: "/skills/beta" },
          { name: "duplicate-message", location: "/skills/alpha" },
        ],
      ),
    ).toEqual([
      { name: "alpha", location: "/skills/alpha" },
      { name: "beta", location: "/skills/beta" },
    ]);
  });
});

describe("createAssistantMessage", () => {
  it("builds a persisted assistant message shape", () => {
    const message = createAssistantMessage("turn-1", "hello");

    expect(message.id).toMatch(/^assistant-/);
    expect(message.turnId).toBe("turn-1");
    expect(message.content).toBe("hello");
    expect(message.role).toBe("assistant");
    expect(message.attachments).toEqual([]);
    expect(message.skillActivations).toEqual([]);
  });
});
