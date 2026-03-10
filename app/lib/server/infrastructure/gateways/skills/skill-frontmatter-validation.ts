import type { SkillFrontmatter } from "~/lib/contracts/skills/frontmatter";
import { readSkillFrontmatterScalarValidationError } from "~/lib/domain/value-objects/skill-frontmatter";

export function validateSkillFrontmatterForDirectory(
  frontmatter: SkillFrontmatter,
  expectedDirectoryName: string,
): string | null {
  const scalarValidationError =
    readSkillFrontmatterScalarValidationError(frontmatter);
  if (scalarValidationError) {
    return scalarValidationError;
  }

  const name = frontmatter.name.trim();
  const normalizedDirectoryName = expectedDirectoryName.trim();

  if (normalizedDirectoryName && normalizedDirectoryName !== name) {
    return `Skill directory name "${normalizedDirectoryName}" must match frontmatter name "${name}".`;
  }

  return null;
}
