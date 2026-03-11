import nodeFsPromises from "node:fs/promises";
import path from "node:path";
import {
  parseSkillRegistrySkillName,
  readSkillRegistryOptionById,
  readSkillRegistrySkillNameValidationMessage,
} from "~/lib/domain/value-objects/skill-registry";
import type {
  SkillRegistryDeleteOptions,
  SkillRegistryDeleteResult,
} from "~/lib/server/infrastructure/gateways/skills/skill-registry-gateway-types";
import {
  invalidateSkillRegistryListCache,
} from "~/lib/server/infrastructure/gateways/skills/skill-registry-remote";
import {
  directoryExists,
  removeDirectoryWhenEmpty,
  removeEmptyAncestorDirectories,
  resolveAppDataSkillsRoot,
} from "~/lib/server/infrastructure/gateways/skills/skill-registry-storage";

export async function deleteInstalledSkillFromRegistry(
  options: SkillRegistryDeleteOptions,
): Promise<SkillRegistryDeleteResult> {
  const registry = readSkillRegistryOptionById(options.registryId);
  if (!registry) {
    throw new Error("Unsupported skill registry.");
  }

  const parsedSkillName = parseSkillRegistrySkillName(
    registry.id,
    options.skillName,
  );
  if (!parsedSkillName) {
    throw new Error(readSkillRegistrySkillNameValidationMessage(registry.id));
  }
  const registrySkillName = parsedSkillName.normalizedSkillName;

  const appDataSkillsRoot = resolveAppDataSkillsRoot(options);
  const registryInstallRoot = path.join(
    appDataSkillsRoot,
    registry.installDirectoryName,
  );
  const skillInstallRoot = path.join(
    registryInstallRoot,
    ...registrySkillName.split("/"),
  );
  const installLocation = path.join(skillInstallRoot, "SKILL.md");

  const exists = await directoryExists(skillInstallRoot);
  if (!exists) {
    return {
      skillName: registrySkillName,
      installLocation,
      removed: false,
    };
  }

  await nodeFsPromises.rm(skillInstallRoot, { recursive: true, force: true });
  await removeEmptyAncestorDirectories(skillInstallRoot, registryInstallRoot);
  await removeDirectoryWhenEmpty(registryInstallRoot);
  await invalidateSkillRegistryListCache(registry.id);
  return {
    skillName: registrySkillName,
    installLocation,
    removed: true,
  };
}
