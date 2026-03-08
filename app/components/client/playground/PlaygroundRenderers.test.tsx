/**
 * Test module verifying Playground markdown rendering behavior.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { renderMessageContent } from "./PlaygroundRenderers";

describe("renderMessageContent", () => {
  it("renders TeX slash delimiters with KaTeX", () => {
    const markup = renderToStaticMarkup(
      <div>
        {renderMessageContent(
          {
            id: "assistant-1",
            role: "assistant",
            content: [
              "中心化 \\(Y_i=\\frac{X_i-\\mu}{\\sigma}\\) とする。",
              "",
              "\\[",
              "Z_n=\\frac{1}{\\sqrt n}\\sum_{i=1}^n Y_i",
              "\\]",
            ].join("\n"),
            createdAt: "2026-03-07T00:00:00.000Z",
            turnId: "turn-1",
            attachments: [],
            skillActivations: [],
          },
          () => undefined,
        )}
      </div>,
    );

    expect(markup).toContain("katex");
    expect(markup).toContain("katex-display");
    expect(markup).not.toContain("\\[");
    expect(markup).not.toContain("\\(");
  });
});
