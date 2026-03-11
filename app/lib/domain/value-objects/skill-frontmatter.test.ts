import { describe, expect, it } from "vitest";
import {
  normalizeSkillFrontmatterDescription,
  normalizeSkillFrontmatterName,
  readSkillFrontmatterScalarValidationError,
  SKILL_FRONTMATTER_DESCRIPTION_MAX_LENGTH,
  SKILL_FRONTMATTER_NAME_MAX_LENGTH,
} from "./skill-frontmatter";

describe("skill-frontmatter", () => {
  it("normalizes name and description scalars", () => {
    expect(normalizeSkillFrontmatterName("  workspace-skill  ")).toBe(
      "workspace-skill",
    );
    expect(normalizeSkillFrontmatterDescription("  Workspace workflow  ")).toBe(
      "Workspace workflow",
    );
  });

  it("validates required, format, and length rules", () => {
    expect(
      readSkillFrontmatterScalarValidationError({
        name: "",
        description: "Workspace workflow",
      }),
    ).toBe("Skill frontmatter name is required.");

    expect(
      readSkillFrontmatterScalarValidationError({
        name: "Workspace Skill",
        description: "Workspace workflow",
      }),
    ).toBe("Skill name must use lower-case kebab-case.");

    expect(
      readSkillFrontmatterScalarValidationError({
        name: "workspace-skill",
        description: "",
      }),
    ).toBe("Skill description is required.");

    expect(
      readSkillFrontmatterScalarValidationError({
        name: "a".repeat(SKILL_FRONTMATTER_NAME_MAX_LENGTH + 1),
        description: "Workspace workflow",
      }),
    ).toBe(
      `Skill name must be ${SKILL_FRONTMATTER_NAME_MAX_LENGTH} characters or fewer.`,
    );

    expect(
      readSkillFrontmatterScalarValidationError({
        name: "workspace-skill",
        description: "a".repeat(SKILL_FRONTMATTER_DESCRIPTION_MAX_LENGTH + 1),
      }),
    ).toBe(
      `Skill description must be ${SKILL_FRONTMATTER_DESCRIPTION_MAX_LENGTH} characters or fewer.`,
    );
  });

  it("accepts valid frontmatter scalars", () => {
    expect(
      readSkillFrontmatterScalarValidationError({
        name: "workspace-skill",
        description: "Workspace workflow",
      }),
    ).toBeNull();
  });
});
