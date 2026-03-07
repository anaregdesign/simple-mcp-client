/**
 * Test module verifying markdown math normalization behavior.
 */
import { describe, expect, it } from "vitest";
import { normalizeChatMarkdownMath } from "./math-markdown";

describe("normalizeChatMarkdownMath", () => {
  it("converts TeX slash delimiters into markdown math delimiters", () => {
    const source = [
      "中心化 \\(Y_i=\\frac{X_i-\\mu}{\\sigma}\\) とする。",
      "",
      "\\[",
      "Z_n=\\frac{1}{\\sqrt n}\\sum_{i=1}^n Y_i",
      "\\]",
    ].join("\n");

    expect(normalizeChatMarkdownMath(source)).toBe([
      "中心化 $Y_i=\\frac{X_i-\\mu}{\\sigma}$ とする。",
      "",
      "",
      "$$",
      "Z_n=\\frac{1}{\\sqrt n}\\sum_{i=1}^n Y_i",
      "$$",
      "",
    ].join("\n"));
  });

  it("keeps inline code and fenced code blocks unchanged", () => {
    const source = [
      "`literal \\\\(x+y\\\\)`",
      "",
      "```tex",
      "\\(",
      "x+y",
      "\\)",
      "```",
    ].join("\n");

    expect(normalizeChatMarkdownMath(source)).toBe(source);
  });

  it("wraps standalone display math environments", () => {
    const source = [
      "次を示す。",
      "",
      "\\begin{align}",
      "f(x) &= x^2 \\\\",
      "g(x) &= x^3",
      "\\end{align}",
    ].join("\n");

    expect(normalizeChatMarkdownMath(source)).toBe([
      "次を示す。",
      "",
      "",
      "$$",
      "\\begin{align}",
      "f(x) &= x^2 \\\\",
      "g(x) &= x^3",
      "\\end{align}",
      "$$",
      "",
    ].join("\n"));
  });
});
