/**
 * Test module verifying title behavior.
 */
import { describe, expect, it } from "vitest";
import { buildThreadAutoTitleRequestMessage } from "~/lib/contracts/threads/title";

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
