import { describe, expect, it } from "vitest";
import {
  readInstructionEnhancementComparison,
} from "./instruction-enhancement-response";

describe("readInstructionEnhancementComparison", () => {
  it("returns a comparison when the patch changes the instruction", () => {
    expect(
      readInstructionEnhancementComparison({
        currentInstruction: "# Original instruction",
        responseMessage: [
          "--- a/instruction.md",
          "+++ b/instruction.md",
          "@@ -1 +1 @@",
          "-# Original instruction",
          "+# Enhanced instruction",
        ].join("\n"),
        instructionExtension: "md",
        instructionLanguage: "english",
      }),
    ).toEqual({
      original: "# Original instruction",
      enhanced: "# Enhanced instruction",
      extension: "md",
      language: "english",
      diffPatch: [
        "--- a/instruction.md",
        "+++ b/instruction.md",
        "@@ -1 +1 @@",
        "-# Original instruction",
        "+# Enhanced instruction",
      ].join("\n"),
    });
  });

  it("returns null when the model suggests no patch", () => {
    expect(
      readInstructionEnhancementComparison({
        currentInstruction: "# Original instruction",
        responseMessage: "   ",
        instructionExtension: "md",
        instructionLanguage: "english",
      }),
    ).toBeNull();
  });
});
