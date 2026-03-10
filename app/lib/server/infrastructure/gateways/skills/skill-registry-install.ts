import nodeCrypto from "node:crypto";
import nodeFsPromises from "node:fs/promises";
import path from "node:path";
import {
  parseSkillRegistrySkillName,
  readSkillRegistryOptionById,
  readSkillRegistrySkillNameValidationMessage,
} from "~/lib/domain/value-objects/skill-registry";
import type {
  SkillRegistryInstallOptions,
  SkillRegistryInstallResult,
} from "~/lib/server/infrastructure/gateways/skills/skill-registry-gateway-types";
import {
  buildVersionChecksumFromBlobEntries,
  fetchRegistryFileBytes,
  invalidateSkillRegistryListCache,
  normalizeSkillName,
  readRegistrySkillBlobEntries,
} from "~/lib/server/infrastructure/gateways/skills/skill-registry-remote";
import {
  directoryExists,
  isInstalledSkillMetadataCurrent,
  isSafeRelativePath,
  normalizeRepoPath,
  readInstalledSkillMetadata,
  resolveAppDataSkillsRoot,
  validateInstalledSkill,
  writeInstalledSkillMetadata,
} from "~/lib/server/infrastructure/gateways/skills/skill-registry-storage";

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
