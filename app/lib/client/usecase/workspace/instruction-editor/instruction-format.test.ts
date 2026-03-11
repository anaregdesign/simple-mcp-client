import { describe, expect, it } from "vitest";
import {
  buildInstructionEnhanceMessage,
  buildInstructionSuggestedFileName,
  detectInstructionLanguage,
  resolveInstructionFormatExtension,
  resolveInstructionSourceFileName,
  validateEnhancedInstructionFormat,
} from "./instruction-format";

describe("instruction format helpers", () => {
  it("resolves source file name from loaded file", () => {
    expect(resolveInstructionSourceFileName("prompt.md")).toBe("prompt.md");
    expect(resolveInstructionSourceFileName("  prompt.md  ")).toBe("prompt.md");
    expect(resolveInstructionSourceFileName(null)).toBeNull();
  });

  it("builds suggested save file name from source and content", () => {
    expect(buildInstructionSuggestedFileName("prompt.md", "text")).toBe("prompt.md");
    expect(buildInstructionSuggestedFileName("prompt.bin", '{"a":1}')).toBe("prompt.json");
    expect(buildInstructionSuggestedFileName(null, "<root/>")).toBe("instruction.xml");
  });

  it("resolves extension from file name and content fallback", () => {
    expect(resolveInstructionFormatExtension("prompt.json", "text")).toBe("json");
    expect(resolveInstructionFormatExtension(null, '{"a":1}')).toBe("json");
    expect(resolveInstructionFormatExtension(null, "<root><a>1</a></root>")).toBe("xml");
    expect(resolveInstructionFormatExtension(null, "# Title\n- item")).toBe("md");
    expect(resolveInstructionFormatExtension(null, "plain text")).toBe("txt");
  });

  it("detects language from script usage", () => {
    expect(detectInstructionLanguage("こんにちは")).toBe("japanese");
    expect(detectInstructionLanguage("Hello world")).toBe("english");
    expect(detectInstructionLanguage("Hello こんにちは")).toBe("mixed");
  });

  it("builds enhance message with language and extension constraints", () => {
    const message = buildInstructionEnhanceMessage({
      instruction: "You are concise.",
      extension: "md",
      language: "english",
    });
    expect(message).toContain("<enhance_request>");
    expect(message).toContain("<editing_boundaries>");
    expect(message).toContain("<diff_contract>");
    expect(message).toContain("<output_contract>");
    expect(message).toContain(
      "Improve this instruction so the user's intent is realized precisely.",
    );
    expect(message).toContain("Preserve original information as much as possible.");
    expect(message).toContain(
      "Do not add placeholder comments/markers such as '省略', 'omitted', 'same as original', or equivalent.",
    );
    expect(message).toContain("Preserve the original language (English).");
    expect(message).toContain("Preserve the original file format style for .md.");
    expect(message).toContain(
      "Think step-by-step internally before responding, but do not reveal your reasoning.",
    );
    expect(message).toContain("Set fileName to instruction.md.");
    expect(message).toContain(
      "Before output, verify objective completion, schema validity, and patch consistency.",
    );
    expect(message).toContain("Use hunk lines with op values: context, add, remove.");
    expect(message).toContain("Return hunks sorted by oldStart in strictly ascending order.");
    expect(message).toContain("Do not return overlapping hunks or duplicate source ranges.");
    expect(message).toContain(
      "If any internal check fails, return the requested fileName with an empty hunks array.",
    );
    expect(message).toContain("oldStart/newStart must match exact 1-based line numbers");
    expect(message).toContain("<instruction>");
  });

  it("validates enhanced format", () => {
    expect(validateEnhancedInstructionFormat('{"a":1}', "json")).toEqual({
      ok: true,
      value: true,
    });
    expect(validateEnhancedInstructionFormat("not-json", "json")).toEqual({
      ok: false,
      error: "Enhanced instruction is not valid JSON. Please retry.",
    });
    expect(validateEnhancedInstructionFormat("<root/>", "xml")).toEqual({
      ok: true,
      value: true,
    });
    expect(validateEnhancedInstructionFormat("root text", "xml")).toEqual({
      ok: false,
      error: "Enhanced instruction is not valid XML-like content. Please retry.",
    });
  });
});
