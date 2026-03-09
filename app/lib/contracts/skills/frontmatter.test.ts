/**
 * Test module verifying frontmatter behavior.
 */
import { describe, expect, it } from "vitest";
import {
  parseSkillFrontmatter,
  validateSkillFrontmatter,
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

describe("validateSkillFrontmatter", () => {
  it("accepts matching skill names", () => {
    const error = validateSkillFrontmatter(
      {
        name: "workspace-skill",
        description: "Workspace workflow",
      },
      "workspace-skill",
    );

    expect(error).toBeNull();
  });

  it("rejects mismatched directory names", () => {
    const error = validateSkillFrontmatter(
      {
        name: "workspace-skill",
        description: "Workspace workflow",
      },
      "another-name",
    );

    expect(error).toBe(
      'Skill directory name "another-name" must match frontmatter name "workspace-skill".',
    );
  });
});
