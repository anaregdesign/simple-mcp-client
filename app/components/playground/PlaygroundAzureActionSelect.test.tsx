import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SSRProvider } from "@fluentui/react-components";
import { describe, expect, it, vi } from "vitest";
import {
  handlePlaygroundAzureActionSelectKeyDown,
  PlaygroundAzureActionSelect,
} from "./PlaygroundAzureActionSelect";

describe("PlaygroundAzureActionSelect", () => {
  it("renders the action select with the requested label and title", () => {
    const markup = renderToStaticMarkup(
      <SSRProvider>
        <PlaygroundAzureActionSelect
          target="project"
          label="Project"
          text="Reload projects"
          title="Reload Azure projects."
          disabled={false}
          onAction={() => undefined}
        />
      </SSRProvider>,
    );

    expect(markup).toContain('id="chat-azure-project-action"');
    expect(markup).toContain('aria-label="Project"');
    expect(markup).toContain("Reload projects");
    expect(markup).toContain('title="Reload Azure projects."');
  });

  it("triggers the action only for Enter and Space", () => {
    const onAction = vi.fn();
    const preventDefault = vi.fn();

    handlePlaygroundAzureActionSelectKeyDown(
      { key: "Enter", preventDefault } as never,
      onAction,
    );
    handlePlaygroundAzureActionSelectKeyDown(
      { key: " ", preventDefault } as never,
      onAction,
    );
    handlePlaygroundAzureActionSelectKeyDown(
      { key: "ArrowDown", preventDefault } as never,
      onAction,
    );

    expect(onAction).toHaveBeenCalledTimes(2);
    expect(preventDefault).toHaveBeenCalledTimes(2);
  });
});
