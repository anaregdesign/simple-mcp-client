import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SSRProvider } from "@fluentui/react-components";
import { describe, expect, it } from "vitest";
import { PlaygroundAddedSkillAndMcpBubbles } from "./PlaygroundAddedSkillAndMcpBubbles";

describe("PlaygroundAddedSkillAndMcpBubbles", () => {
  it("renders message skills, thread skills, and MCP server bubbles", () => {
    const markup = renderToStaticMarkup(
      <SSRProvider>
        <PlaygroundAddedSkillAndMcpBubbles
          selectedThreadSkills={[
            {
              name: "Thread Search",
              location: "skills/thread-search.md",
            },
          ]}
          selectedMessageSkillActivations={[
            {
              name: "Draft Summary",
              location: "skills/draft-summary.md",
            },
          ]}
          mcpServers={[
            {
              id: "server-1",
              name: "GitHub",
              transport: "stdio",
              command: "npx",
              args: ["github-mcp"],
              cwd: "/tmp",
              env: { GITHUB_TOKEN: "token" },
            },
          ]}
          isSending={false}
          isThreadReadOnly={false}
          onRemoveThreadSkill={() => undefined}
          onRemoveMessageSkillActivation={() => undefined}
          onRemoveMcpServer={() => undefined}
        />
      </SSRProvider>,
    );

    expect(markup).toContain("Draft Summary");
    expect(markup).toContain("Thread Search");
    expect(markup).toContain("GitHub");
    expect(markup).toContain('aria-label="Remove message skill activation Draft Summary"');
    expect(markup).toContain('aria-label="Remove thread skill Thread Search"');
    expect(markup).toContain('aria-label="Remove MCP server GitHub"');
  });
});
