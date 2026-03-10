import { describe, expect, it } from "vitest";
import { validateSkillFrontmatterForDirectory } from "~/lib/server/infrastructure/gateways/skills/skill-frontmatter-validation";

describe("validateSkillFrontmatterForDirectory", () => {
  it("accepts matching skill names", () => {
    const error = validateSkillFrontmatterForDirectory(
      {
        name: "workspace-skill",
        description: "Workspace workflow",
      },
      "workspace-skill",
    );

    expect(error).toBeNull();
  });

  it("rejects mismatched directory names", () => {
    const error = validateSkillFrontmatterForDirectory(
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

  it("rejects invalid skill names", () => {
    const error = validateSkillFrontmatterForDirectory(
      {
        name: "Workspace Skill",
        description: "Workspace workflow",
      },
      "Workspace Skill",
    );

    expect(error).toBe("Skill name must use lower-case kebab-case.");
  });

  it("rejects empty descriptions before directory matching", () => {
    const error = validateSkillFrontmatterForDirectory(
      {
        name: "workspace-skill",
        description: "   ",
      },
      "another-name",
    );

    expect(error).toBe("Skill description is required.");
  });
});
