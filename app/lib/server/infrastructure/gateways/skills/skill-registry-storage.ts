import nodeFs from "node:fs";
import nodeFsPromises from "node:fs/promises";
import path from "node:path";
import nodeUrl from "node:url";
import {
  WORKSPACE_SKILLS_DIRECTORY_NAME,
  WORKSPACE_USERS_DIRECTORY_NAME,
} from "~/lib/constants/persistence";
import { parseSkillFrontmatter } from "~/lib/contracts/skills/frontmatter";
import type {
  InstalledSkillMetadata,
  ResolveSkillRegistryOptions,
} from "~/lib/server/infrastructure/gateways/skills/skill-registry-gateway-types";
import type { SkillRegistryOption } from "~/lib/domain/value-objects/skill-registry";
import { resolveWorkspaceUserSkillsDirectory } from "~/lib/server/infrastructure/config/workspace-storage-paths";
import { validateSkillFrontmatterForDirectory } from "~/lib/server/infrastructure/gateways/skills/skill-frontmatter-validation";

const fsConstants = nodeFs.constants;
const INSTALLED_SKILL_METADATA_FILE_NAME = ".local-playground-skill.json";

export async function validateInstalledSkill(
  skillInstallRoot: string,
  expectedSkillName: string,
): Promise<void> {
  const skillFilePath = path.join(skillInstallRoot, "SKILL.md");
  const skillFileContent = await nodeFsPromises
    .readFile(skillFilePath, "utf8")
    .catch(() => "");
  const frontmatter = parseSkillFrontmatter(skillFileContent);
  if (!frontmatter) {
    throw new Error("Installed Skill is missing valid frontmatter.");
  }

  const validationError = validateSkillFrontmatterForDirectory(
    frontmatter,
    expectedSkillName,
  );
  if (validationError) {
    throw new Error(validationError);
  }
}

export async function writeInstalledSkillMetadata(options: {
  skillInstallRoot: string;
  registry: SkillRegistryOption;
  skillName: string;
  skillPath: string;
  sourceRootPath: string;
  versionChecksum: string;
  contentChecksum: string;
}): Promise<void> {
  const metadata = {
    formatVersion: 1,
    registryId: options.registry.id,
    registryLabel: options.registry.label,
    repository: options.registry.repository,
    ref: options.registry.ref,
    sourcePath: options.sourceRootPath,
    skillName: options.skillName,
    skillPath: options.skillPath,
    installedAt: new Date().toISOString(),
    versionChecksum: options.versionChecksum,
    contentChecksum: options.contentChecksum,
  };

  const metadataPath = path.join(
    options.skillInstallRoot,
    INSTALLED_SKILL_METADATA_FILE_NAME,
  );
  await nodeFsPromises.writeFile(
    metadataPath,
    `${JSON.stringify(metadata, null, 2)}\n`,
    "utf8",
  );
}

export async function readInstalledSkillMetadata(
  skillInstallRoot: string,
): Promise<InstalledSkillMetadata | null> {
  const metadataPath = path.join(
    skillInstallRoot,
    INSTALLED_SKILL_METADATA_FILE_NAME,
  );
  const metadataContent = await nodeFsPromises
    .readFile(metadataPath, "utf8")
    .catch(() => "");
  if (!metadataContent.trim()) {
    return null;
  }

  try {
    return readInstalledSkillMetadataFromUnknown(
      JSON.parse(metadataContent) as unknown,
    );
  } catch {
    return null;
  }
}

export function readInstalledSkillMetadataFromUnknown(
  value: unknown,
): InstalledSkillMetadata | null {
  if (!isRecord(value)) {
    return null;
  }

  const formatVersion =
    typeof value.formatVersion === "number" &&
    Number.isInteger(value.formatVersion)
      ? value.formatVersion
      : 0;
  const registryId =
    typeof value.registryId === "string" ? value.registryId.trim() : "";
  const sourcePath =
    typeof value.sourcePath === "string"
      ? normalizeRepoPath(value.sourcePath)
      : "";
  const skillName =
    typeof value.skillName === "string" ? value.skillName.trim() : "";
  const skillPath =
    typeof value.skillPath === "string"
      ? normalizeRepoPath(value.skillPath)
      : "";
  const versionChecksum =
    typeof value.versionChecksum === "string"
      ? value.versionChecksum.trim()
      : "";
  if (
    formatVersion !== 1 ||
    !registryId ||
    !sourcePath ||
    !skillName ||
    !skillPath ||
    !versionChecksum
  ) {
    return null;
  }

  return {
    formatVersion,
    registryId,
    sourcePath,
    skillName,
    skillPath,
    versionChecksum,
  };
}

export function isInstalledSkillMetadataCurrent(options: {
  metadata: InstalledSkillMetadata | null;
  registryId: string;
  sourceRootPath: string;
  skillPath: string;
  remoteVersionChecksum: string;
}): boolean {
  if (!options.metadata || !options.remoteVersionChecksum.trim()) {
    return false;
  }

  return (
    options.metadata.registryId === options.registryId &&
    options.metadata.sourcePath === options.sourceRootPath &&
    options.metadata.skillPath === options.skillPath &&
    options.metadata.versionChecksum === options.remoteVersionChecksum
  );
}

export function resolveAppDataSkillsRoot(
  options: ResolveSkillRegistryOptions,
): string {
  const workspaceUserSkillsDirectoryName = readWorkspaceUserSkillsDirectoryName(
    options.workspaceUserId,
  );
  const configuredWorkspaceStorageDirectory =
    typeof options.workspaceStorageDirectory === "string"
      ? options.workspaceStorageDirectory.trim()
      : "";
  if (configuredWorkspaceStorageDirectory) {
    return path.resolve(
      configuredWorkspaceStorageDirectory,
      WORKSPACE_USERS_DIRECTORY_NAME,
      workspaceUserSkillsDirectoryName,
      WORKSPACE_SKILLS_DIRECTORY_NAME,
    );
  }

  const configuredDatabaseUrl = resolveConfiguredDatabaseUrlFromEnvironment();
  if (configuredDatabaseUrl) {
    const sqliteFilePath = resolveSqliteDatabaseFilePath(configuredDatabaseUrl);
    if (sqliteFilePath) {
      return path.resolve(
        path.dirname(sqliteFilePath),
        WORKSPACE_USERS_DIRECTORY_NAME,
        workspaceUserSkillsDirectoryName,
        WORKSPACE_SKILLS_DIRECTORY_NAME,
      );
    }
  }

  return resolveWorkspaceUserSkillsDirectory({
    workspaceUserId: options.workspaceUserId,
    platform: options.platform,
    homeDirectory: options.homeDirectory,
    appDataDirectory: options.appDataDirectory,
  });
}

export function isSafeRelativePath(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }

  if (normalized.startsWith("/") || normalized.startsWith("\\")) {
    return false;
  }

  const segments = normalized.replaceAll("\\", "/").split("/");
  return segments.every(
    (segment) => segment.length > 0 && segment !== "." && segment !== "..",
  );
}

export async function removeDirectoryWhenEmpty(
  directoryPath: string,
): Promise<void> {
  if (!(await directoryExists(directoryPath))) {
    return;
  }

  const entries = await nodeFsPromises.readdir(directoryPath);
  if (entries.length === 0) {
    await nodeFsPromises.rm(directoryPath, { recursive: true, force: true });
  }
}

export async function removeEmptyAncestorDirectories(
  childPath: string,
  stopAtPath: string,
): Promise<void> {
  const normalizedStopPath = path.resolve(stopAtPath);
  let currentPath = path.resolve(path.dirname(childPath));

  while (currentPath.startsWith(`${normalizedStopPath}${path.sep}`)) {
    await removeDirectoryWhenEmpty(currentPath);

    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) {
      break;
    }

    currentPath = parentPath;
  }
}

export async function directoryExists(directoryPath: string): Promise<boolean> {
  try {
    await nodeFsPromises.access(
      directoryPath,
      fsConstants.F_OK | fsConstants.R_OK,
    );
    return true;
  } catch {
    return false;
  }
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await nodeFsPromises.access(filePath, fsConstants.F_OK | fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export function normalizeRepoPath(value: string): string {
  return value
    .replaceAll("\\", "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .join("/");
}

export function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function readWorkspaceUserSkillsDirectoryName(workspaceUserId: number): string {
  if (!Number.isInteger(workspaceUserId) || workspaceUserId <= 0) {
    throw new Error("`workspaceUserId` must be a positive integer.");
  }

  return String(workspaceUserId);
}

function resolveConfiguredDatabaseUrlFromEnvironment(): string {
  const candidateKeys = ["LOCAL_PLAYGROUND_DATABASE_URL", "DATABASE_URL"];
  for (const key of candidateKeys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function resolveSqliteDatabaseFilePath(databaseUrl: string): string | null {
  if (!databaseUrl.startsWith("file:")) {
    return null;
  }

  if (
    databaseUrl === "file:memory" ||
    databaseUrl === "file::memory:" ||
    /[?&]mode=memory(?:&|$)/i.test(databaseUrl)
  ) {
    return null;
  }

  try {
    if (databaseUrl.startsWith("file://")) {
      return nodeUrl.fileURLToPath(databaseUrl);
    }
  } catch {
    return null;
  }

  const withoutPrefix = databaseUrl.slice("file:".length);
  const queryIndex = withoutPrefix.indexOf("?");
  const rawPath = (
    queryIndex >= 0 ? withoutPrefix.slice(0, queryIndex) : withoutPrefix
  ).trim();
  if (!rawPath || rawPath === ":memory:") {
    return null;
  }

  const decodedPath = decodeURIComponent(rawPath);
  if (path.isAbsolute(decodedPath)) {
    return decodedPath;
  }

  return path.resolve(decodedPath);
}
