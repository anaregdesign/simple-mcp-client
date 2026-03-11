/**
 * Test module verifying instruction-context behavior.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_THREAD_INSTRUCTION_CONTEXT_TOGGLES,
  cloneThreadInstructionContextToggles,
  hasNonDefaultThreadInstructionContextToggles,
  readThreadInstructionContextTogglesFromUnknown,
} from "~/lib/domain/value-objects/thread-instruction-context";

describe("thread instruction-context toggles", () => {
  it("exposes default toggles", () => {
    expect(DEFAULT_THREAD_INSTRUCTION_CONTEXT_TOGGLES).toEqual({
      system: true,
    });
  });

  it("parses a valid toggle payload", () => {
    expect(
      readThreadInstructionContextTogglesFromUnknown({
        system: false,
      }),
    ).toEqual({
      system: false,
    });
  });

  it("rejects invalid or incomplete toggle payloads", () => {
    expect(readThreadInstructionContextTogglesFromUnknown(null)).toBeNull();
    expect(readThreadInstructionContextTogglesFromUnknown({})).toBeNull();
    expect(
      readThreadInstructionContextTogglesFromUnknown({
        system: "yes",
      }),
    ).toBeNull();
  });

  it("clones toggles and detects non-default values", () => {
    const cloned = cloneThreadInstructionContextToggles({
      system: false,
    });

    expect(cloned).toEqual({
      system: false,
    });
    expect(hasNonDefaultThreadInstructionContextToggles(cloned)).toBe(true);
    expect(
      hasNonDefaultThreadInstructionContextToggles(DEFAULT_THREAD_INSTRUCTION_CONTEXT_TOGGLES),
    ).toBe(false);
  });
});
