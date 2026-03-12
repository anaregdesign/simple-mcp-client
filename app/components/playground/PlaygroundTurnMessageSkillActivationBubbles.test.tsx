import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SSRProvider } from "@fluentui/react-components";
import { describe, expect, it } from "vitest";
import { PlaygroundTurnMessageSkillActivationBubbles } from "./PlaygroundTurnMessageSkillActivationBubbles";

describe("PlaygroundTurnMessageSkillActivationBubbles", () => {
  it("renders skill activations for user messages", () => {
    const markup = renderToStaticMarkup(
      <SSRProvider>
        <PlaygroundTurnMessageSkillActivationBubbles
          message={{
            id: "message-1",
            role: "user",
            content: "Use summary skill",
            turnId: "turn-1",
            skillActivations: [
              {
                name: "Summary",
                location: "skills/summary.md",
              },
            ],
          }}
        />
      </SSRProvider>,
    );

    expect(markup).toContain("Summary");
    expect(markup).toContain("Message Skill Activations used in this turn");
  });

  it("does not render bubbles for assistant messages", () => {
    const markup = renderToStaticMarkup(
      <SSRProvider>
        <PlaygroundTurnMessageSkillActivationBubbles
          message={{
            id: "message-1",
            role: "assistant",
            content: "Done",
            turnId: "turn-1",
            skillActivations: [
              {
                name: "Summary",
                location: "skills/summary.md",
              },
            ],
          }}
        />
      </SSRProvider>,
    );

    expect(markup).toBe("");
  });
});
