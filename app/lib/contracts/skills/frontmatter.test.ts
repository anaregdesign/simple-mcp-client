/**
 * Test module verifying frontmatter behavior.
 */
import { describe, expect, it } from "vitest";
import {
  parseSkillFrontmatter,
} from "~/lib/contracts/skills/frontmatter";

describe("parseSkillFrontmatter", () => {
  it("parses name and description from YAML frontmatter", () => {
    const parsed = parseSkillFrontmatter([
      "---",
      "name: workspace-skill",
      "description: Workspace workflow",
      "---",
      "# Skill",
      "details",
    ].join("\n"));

    expect(parsed).toEqual({
      name: "workspace-skill",
      description: "Workspace workflow",
    });
  });

  it("parses block scalar descriptions", () => {
    const parsed = parseSkillFrontmatter([
      "---",
      "name: workspace-skill",
      "description: |",
      "  First line",
      "  Second line",
      "---",
      "Body",
    ].join("\n"));

    expect(parsed).toEqual({
      name: "workspace-skill",
      description: "First line\nSecond line",
    });
  });

  it("returns null when required frontmatter is missing", () => {
    expect(parseSkillFrontmatter("# no frontmatter")).toBeNull();
  });
});
