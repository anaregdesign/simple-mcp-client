import path from "node:path";
import {
  readSkillRegistryOptionById,
  SKILL_REGISTRY_OPTIONS,
  type SkillRegistryOption,
} from "~/lib/domain/value-objects/skill-registry";
import type { SkillRegistryCatalog } from "~/lib/contracts/skills/types";
import type {
  ReadSkillRegistryCatalogOptions,
  ResolveSkillRegistryOptions,
  SkillRegistryCatalogDiscoveryResult,
} from "~/lib/server/infrastructure/gateways/skills/skill-registry-gateway-types";
import {
  buildRepositoryUrl,
  readRegistrySkills,
  readRegistryVersionChecksumBySkillPath,
} from "~/lib/server/infrastructure/gateways/skills/skill-registry-remote";
import {
  fileExists,
  isInstalledSkillMetadataCurrent,
  readErrorMessage,
  readInstalledSkillMetadata,
  resolveAppDataSkillsRoot,
  normalizeRepoPath,
} from "~/lib/server/infrastructure/gateways/skills/skill-registry-storage";

export async function discoverSkillRegistries(
  options: ResolveSkillRegistryOptions,
): Promise<SkillRegistryCatalogDiscoveryResult> {
  const appDataSkillsRoot = resolveAppDataSkillsRoot(options);
  const catalogs: SkillRegistryCatalog[] = [];
  const warnings: string[] = [];

  for (const registry of SKILL_REGISTRY_OPTIONS) {
    try {
      catalogs.push(
        await readSkillRegistryCatalog(registry, {
          appDataSkillsRoot,
          forceRefresh: options.forceRefresh,
        }),
      );
    } catch (error) {
      warnings.push(
        `Failed to load ${registry.label} registry: ${readErrorMessage(error)}`,
      );
      catalogs.push({
        registryId: registry.id,
        registryLabel: registry.label,
        registryDescription: registry.description,
        repository: registry.repository,
        repositoryUrl: buildRepositoryUrl(registry.repository),
        sourcePath: registry.sourcePath,
        skills: [],
      });
    }
  }

  return {
    catalogs,
    warnings,
  };
}

async function readSkillRegistryCatalog(
  registry: SkillRegistryOption,
  options: ReadSkillRegistryCatalogOptions,
): Promise<SkillRegistryCatalog> {
  const registrySkills = await readRegistrySkills(registry, {
    forceRefresh: options.forceRefresh,
  });
  const registryInstallRoot = path.join(
    options.appDataSkillsRoot,
    registry.installDirectoryName,
  );
  const sourceRootPath = normalizeRepoPath(registry.sourcePath);
  const installedSkillEntries = await Promise.all(
    registrySkills.map(async (registrySkill) => {
      const skillInstallRoot = path.join(
        registryInstallRoot,
        ...registrySkill.id.split("/"),
      );
      const installLocation = path.join(skillInstallRoot, "SKILL.md");
      const isInstalled = await fileExists(installLocation);
      const metadata = isInstalled
        ? await readInstalledSkillMetadata(skillInstallRoot)
        : null;

      return {
        id: registrySkill.id,
        installLocation,
        isInstalled,
        metadata,
      };
    }),
  );
  const hasInstalledSkills = installedSkillEntries.some(
    (entry) => entry.isInstalled,
  );
  const versionChecksumBySkillPath = hasInstalledSkills
    ? await readRegistryVersionChecksumBySkillPath({
        registry,
        sourceRootPath,
        forceRefresh: options.forceRefresh,
      })
    : new Map<string, string>();
  const installedSkillEntryById = new Map(
    installedSkillEntries.map((entry) => [entry.id, entry]),
  );
  const skills = await Promise.all(
    registrySkills.map(async (registrySkill) => {
      const installedSkillEntry = installedSkillEntryById.get(registrySkill.id);
      const installLocation = installedSkillEntry?.installLocation
        ? installedSkillEntry.installLocation
        : path.join(
            registryInstallRoot,
            ...registrySkill.id.split("/"),
            "SKILL.md",
          );
      const isInstalled = installedSkillEntry?.isInstalled === true;
      const remoteVersionChecksum =
        versionChecksumBySkillPath.get(registrySkill.id) ?? "";
      const isUpdateAvailable =
        isInstalled &&
        Boolean(remoteVersionChecksum) &&
        !isInstalledSkillMetadataCurrent({
          metadata: installedSkillEntry?.metadata ?? null,
          registryId: registry.id,
          sourceRootPath,
          skillPath: registrySkill.id,
          remoteVersionChecksum,
        });

      return {
        id: registrySkill.id,
        name: registrySkill.name,
        description: `Install ${registrySkill.name} from ${registry.label}.`,
        tag: registrySkill.tag,
        remotePath: `${sourceRootPath}/${registrySkill.id}`,
        installLocation,
        isInstalled,
        isUpdateAvailable,
      };
    }),
  );

  return {
    registryId: registry.id,
    registryLabel: registry.label,
    registryDescription: registry.description,
    repository: registry.repository,
    repositoryUrl: buildRepositoryUrl(registry.repository),
    sourcePath: registry.sourcePath,
    skills,
  };
}
