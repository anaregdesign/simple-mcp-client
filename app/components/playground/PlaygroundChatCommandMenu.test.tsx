import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlaygroundChatCommandMenu } from "./PlaygroundChatCommandMenu";

describe("PlaygroundChatCommandMenu", () => {
  it("renders the empty hint when there are no suggestions", () => {
    const markup = renderToStaticMarkup(
      <PlaygroundChatCommandMenu
        chatCommandMenu={{
          keyword: "@skills",
          query: "",
          emptyHint: "No matching skills.",
          highlightedIndex: 0,
          suggestions: [],
        }}
        chatCommandListboxId="chat-command-listbox"
        onSelectChatCommandSuggestion={() => undefined}
        onHighlightChatCommandSuggestion={() => undefined}
      />,
    );

    expect(markup).toContain("No matching skills.");
    expect(markup).toContain('role="status"');
  });

  it("renders suggestion states for selected and unavailable commands", () => {
    const markup = renderToStaticMarkup(
      <PlaygroundChatCommandMenu
        chatCommandMenu={{
          keyword: "@skills",
          query: "sum",
          emptyHint: "No matching skills.",
          highlightedIndex: 0,
          suggestions: [
            {
              id: "skill:summary",
              label: "Summary",
              description: "Summarize the current thread.",
              detail: "Registry: default",
              isSelected: true,
              isAvailable: true,
            },
            {
              id: "skill:translator",
              label: "Translator",
              description: "Translate the current draft.",
              detail: "Registry: default",
              isSelected: false,
              isAvailable: false,
            },
          ],
        }}
        chatCommandListboxId="chat-command-listbox"
        onSelectChatCommandSuggestion={() => undefined}
        onHighlightChatCommandSuggestion={() => undefined}
      />,
    );

    expect(markup).toContain('id="chat-command-listbox"');
    expect(markup).toContain("Summary");
    expect(markup).toContain("Added");
    expect(markup).toContain("Translator");
    expect(markup).toContain("Unavailable");
  });
});
