import { AGENT_SKILL_NAME_PATTERN } from "~/lib/domain/value-objects/skill-registry";

export type SkillFrontmatterScalars = {
  name: string;
  description: string;
};

export const SKILL_FRONTMATTER_NAME_MAX_LENGTH = 64;
export const SKILL_FRONTMATTER_DESCRIPTION_MAX_LENGTH = 1_024;

export function normalizeSkillFrontmatterName(value: string): string {
  return value.trim();
}

export function normalizeSkillFrontmatterDescription(value: string): string {
  return value.trim();
}

export function readSkillFrontmatterScalarValidationError(
  frontmatter: SkillFrontmatterScalars,
): string | null {
  const name = normalizeSkillFrontmatterName(frontmatter.name);
  const description = normalizeSkillFrontmatterDescription(
    frontmatter.description,
  );

  if (!name) {
    return "Skill frontmatter name is required.";
  }

  if (name.length > SKILL_FRONTMATTER_NAME_MAX_LENGTH) {
    return `Skill name must be ${SKILL_FRONTMATTER_NAME_MAX_LENGTH} characters or fewer.`;
  }

  if (!AGENT_SKILL_NAME_PATTERN.test(name)) {
    return "Skill name must use lower-case kebab-case.";
  }

  if (!description) {
    return "Skill description is required.";
  }

  if (description.length > SKILL_FRONTMATTER_DESCRIPTION_MAX_LENGTH) {
    return `Skill description must be ${SKILL_FRONTMATTER_DESCRIPTION_MAX_LENGTH} characters or fewer.`;
  }

  return null;
}
