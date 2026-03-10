import { describe, expect, it } from "vitest";
import { cloneThreadInstruction } from "~/lib/domain/value-objects/thread-instruction";

describe("thread-instruction", () => {
  it("clones an instruction object", () => {
    const instruction = {
      id: 1,
      threadId: "thread-a",
      content: "Focus on the current workspace.",
    };

    const cloned = cloneThreadInstruction(instruction);

    expect(cloned).toEqual(instruction);
    expect(cloned).not.toBe(instruction);
  });

  it("preserves null instructions", () => {
    expect(cloneThreadInstruction(null)).toBeNull();
  });
});
