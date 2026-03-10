import {
  AGENT_SKILL_DESCRIPTION_MAX_LENGTH,
  AGENT_SKILL_NAME_MAX_LENGTH,
} from "~/lib/constants/skills";
import { AGENT_SKILL_NAME_PATTERN } from "~/lib/domain/value-objects/skill-registry";
import type { SkillFrontmatter } from "~/lib/contracts/skills/frontmatter";

export function validateSkillFrontmatterForDirectory(
  frontmatter: SkillFrontmatter,
  expectedDirectoryName: string,
): string | null {
  const name = frontmatter.name.trim();
  const description = frontmatter.description.trim();
  const normalizedDirectoryName = expectedDirectoryName.trim();

  if (!name) {
    return "Skill frontmatter name is required.";
  }

  if (name.length > AGENT_SKILL_NAME_MAX_LENGTH) {
    return `Skill name must be ${AGENT_SKILL_NAME_MAX_LENGTH} characters or fewer.`;
  }

  if (!AGENT_SKILL_NAME_PATTERN.test(name)) {
    return "Skill name must use lower-case kebab-case.";
  }

  if (!description) {
    return "Skill description is required.";
  }

  if (description.length > AGENT_SKILL_DESCRIPTION_MAX_LENGTH) {
    return `Skill description must be ${AGENT_SKILL_DESCRIPTION_MAX_LENGTH} characters or fewer.`;
  }

  if (normalizedDirectoryName && normalizedDirectoryName !== name) {
    return `Skill directory name "${normalizedDirectoryName}" must match frontmatter name "${name}".`;
  }

  return null;
}
