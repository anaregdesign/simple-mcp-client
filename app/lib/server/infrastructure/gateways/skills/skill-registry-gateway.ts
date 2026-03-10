import nodeCrypto from "node:crypto";
import nodeFsPromises from "node:fs/promises";
import path from "node:path";
import {
  parseSkillRegistrySkillName,
  readSkillRegistryOptionById,
  readSkillRegistrySkillNameValidationMessage,
  SKILL_REGISTRY_OPTIONS,
  type SkillRegistryOption,
} from "~/lib/domain/value-objects/skill-registry";
import type { SkillRegistryCatalog } from "~/lib/contracts/skills/types";
import type {
  WorkspaceSkillRegistryMutationGateway,
} from "~/lib/domain/repositories/workspace-skill-registry-mutation-gateway";
import {
  type ReadSkillRegistryCatalogOptions,
  type RegistryCatalogSkill,
  type ResolveSkillRegistryOptions,
  type SkillRegistryCatalogDiscoveryResult,
  type SkillRegistryDeleteOptions,
  type SkillRegistryDeleteResult,
  type SkillRegistryInstallOptions,
  type SkillRegistryInstallResult,
} from "~/lib/server/infrastructure/gateways/skills/skill-registry-gateway-types";
import {
  buildRepositoryUrl,
  buildRegistryListCacheKey,
  buildRegistryTreeCacheKey,
  buildVersionChecksumFromBlobEntries,
  fetchRegistryFileBytes,
  invalidateSkillRegistryListCache,
  normalizeSkillName,
  readSkillNamesFromContentsPayload,
  readBlobEntriesFromTreePayload,
  readRegistrySkillPathFromBlobPath,
  readRegistrySkillBlobEntries,
  readRegistrySkills,
  readRegistryVersionChecksumBySkillPath,
} from "~/lib/server/infrastructure/gateways/skills/skill-registry-remote";
import {
  directoryExists,
  fileExists,
  isInstalledSkillMetadataCurrent,
  isSafeRelativePath,
  normalizeRepoPath,
  readErrorMessage,
  readInstalledSkillMetadata,
  readInstalledSkillMetadataFromUnknown,
  removeDirectoryWhenEmpty,
  removeEmptyAncestorDirectories,
  resolveAppDataSkillsRoot,
  validateInstalledSkill,
  writeInstalledSkillMetadata,
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

export async function installSkillFromRegistry(
  options: SkillRegistryInstallOptions,
): Promise<SkillRegistryInstallResult> {
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
  const normalizedSkillName = parsedSkillName.skillName;

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
  const sourceRootPath = normalizeRepoPath(registry.sourcePath);
  const skillPrefix = `${sourceRootPath}/${registrySkillName}/`;
  const matchingBlobEntries = await readRegistrySkillBlobEntries({
    registry,
    sourceRootPath,
    skillPath: registrySkillName,
    forceRefresh: true,
  });
  const remoteVersionChecksum =
    buildVersionChecksumFromBlobEntries(matchingBlobEntries);

  await nodeFsPromises.mkdir(registryInstallRoot, { recursive: true });
  const alreadyInstalled = await directoryExists(skillInstallRoot);
  if (alreadyInstalled) {
    const installedMetadata =
      await readInstalledSkillMetadata(skillInstallRoot);
    const isCurrentVersion = isInstalledSkillMetadataCurrent({
      metadata: installedMetadata,
      registryId: registry.id,
      sourceRootPath,
      skillPath: registrySkillName,
      remoteVersionChecksum,
    });
    if (isCurrentVersion) {
      return {
        skillName: registrySkillName,
        installLocation,
        operation: "unchanged",
      };
    }

    await nodeFsPromises.rm(skillInstallRoot, { recursive: true, force: true });
  }

  await nodeFsPromises.mkdir(skillInstallRoot, { recursive: true });
  try {
    const contentChecksumHash = nodeCrypto.createHash("sha256");
    for (const blobEntry of matchingBlobEntries) {
      const blobPath = blobEntry.path;
      const relativePath = blobPath.slice(skillPrefix.length);
      if (!isSafeRelativePath(relativePath)) {
        throw new Error(`Registry file path is invalid: ${blobPath}`);
      }

      const destinationPath = path.resolve(skillInstallRoot, relativePath);
      const normalizedRoot = path.resolve(skillInstallRoot);
      if (
        destinationPath !== normalizedRoot &&
        !destinationPath.startsWith(`${normalizedRoot}${path.sep}`)
      ) {
        throw new Error(`Registry file path escapes skill root: ${blobPath}`);
      }

      await nodeFsPromises.mkdir(path.dirname(destinationPath), {
        recursive: true,
      });
      const bytes = await fetchRegistryFileBytes({
        registry,
        filePath: blobPath,
      });
      contentChecksumHash.update(relativePath);
      contentChecksumHash.update("\0");
      contentChecksumHash.update(Buffer.from(bytes));
      await nodeFsPromises.writeFile(destinationPath, Buffer.from(bytes));
    }

    await validateInstalledSkill(skillInstallRoot, normalizedSkillName);
    await writeInstalledSkillMetadata({
      skillInstallRoot,
      registry,
      skillName: normalizedSkillName,
      skillPath: registrySkillName,
      sourceRootPath,
      versionChecksum: remoteVersionChecksum,
      contentChecksum: contentChecksumHash.digest("hex"),
    });
  } catch (error) {
    await nodeFsPromises.rm(skillInstallRoot, { recursive: true, force: true });
    throw error;
  }

  await invalidateSkillRegistryListCache(registry.id);
  return {
    skillName: registrySkillName,
    installLocation,
    operation: alreadyInstalled ? "updated" : "installed",
  };
}

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

export function createWorkspaceSkillRegistryMutationGateway(): WorkspaceSkillRegistryMutationGateway {
  return {
    installSkill: installSkillFromRegistry,
    deleteSkill: deleteInstalledSkillFromRegistry,
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

export const skillRegistryServerTestUtils = {
  normalizeSkillName,
  readSkillNamesFromContentsPayload,
  readBlobEntriesFromTreePayload,
  readRegistrySkillPathFromBlobPath,
  buildVersionChecksumFromBlobEntries,
  isInstalledSkillMetadataCurrent,
  readInstalledSkillMetadataFromUnknown,
  buildRegistryListCacheKey,
  buildRegistryTreeCacheKey,
  isSafeRelativePath,
  resolveAppDataSkillsRoot,
};
