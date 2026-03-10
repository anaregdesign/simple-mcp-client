import { describe, expect, it } from "vitest";
import {
  applyInstructionUnifiedDiffPatch,
  normalizeInstructionDiffPatchResponse,
} from "./instruction-diff-patch";

describe("instruction diff patch helpers", () => {
  it("unwraps top-level fenced patch output from model response", () => {
    const normalized = normalizeInstructionDiffPatchResponse("```diff\n@@ -1 +1 @@\n-a\n+b\n```");
    expect(normalized).toBe("@@ -1 +1 @@\n-a\n+b");
  });

  it("applies unified diff patch to instruction text", () => {
    const result = applyInstructionUnifiedDiffPatch(
      "line-1\nline-2\nline-3",
      [
        "--- a/instruction.txt",
        "+++ b/instruction.txt",
        "@@ -1,3 +1,4 @@",
        " line-1",
        "-line-2",
        "+line-2-updated",
        " line-3",
        "+line-4",
      ].join("\n"),
    );

    expect(result).toEqual({
      ok: true,
      value: "line-1\nline-2-updated\nline-3\nline-4",
    });
  });

  it("applies patch even when hunk start line is slightly off", () => {
    const result = applyInstructionUnifiedDiffPatch(
      "line-1\nline-2\nline-3\nline-4",
      [
        "--- a/instruction.txt",
        "+++ b/instruction.txt",
        "@@ -1,2 +1,2 @@",
        " line-2",
        "-line-3",
        "+line-3-updated",
      ].join("\n"),
    );

    expect(result).toEqual({
      ok: true,
      value: "line-1\nline-2\nline-3-updated\nline-4",
    });
  });

  it("returns original instruction when patch is empty", () => {
    expect(applyInstructionUnifiedDiffPatch("same\nlines", "   ")).toEqual({
      ok: true,
      value: "same\nlines",
    });
  });

  it("rejects invalid unified diff patch hunks", () => {
    expect(applyInstructionUnifiedDiffPatch("line-1", "line-1")).toEqual({
      ok: false,
      error: "Enhancement patch is not a valid unified diff hunk format.",
    });
  });
});
