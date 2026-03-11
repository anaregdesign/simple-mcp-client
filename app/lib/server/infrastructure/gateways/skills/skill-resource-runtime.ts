import nodeFs from "node:fs";
import nodeFsPromises from "node:fs/promises";
import path from "node:path";
import {
  AGENT_SKILL_ASSETS_DIRECTORY_NAME,
  AGENT_SKILL_ASSET_FILE_MAX_BYTES,
  AGENT_SKILL_REFERENCES_DIRECTORY_NAME,
  AGENT_SKILL_REFERENCE_FILE_MAX_BYTES,
  AGENT_SKILL_RESOURCES_DIRECTORY_NAME,
  AGENT_SKILL_RESOURCE_MAX_FILES_PER_DIRECTORY,
  AGENT_SKILL_RESOURCE_PATH_MAX_LENGTH,
  AGENT_SKILL_SCRIPTS_DIRECTORY_NAME,
} from "~/lib/constants/skills";

const SKILL_RESOURCE_DIRECTORY_BY_KIND = {
  scripts: AGENT_SKILL_SCRIPTS_DIRECTORY_NAME,
  references: AGENT_SKILL_REFERENCES_DIRECTORY_NAME,
  assets: AGENT_SKILL_ASSETS_DIRECTORY_NAME,
} as const;

// agentskills.io defines scripts/references/assets as canonical directories.
// resources/ is a non-standard optional directory used by some skills.
// Include it when SKILL.md guidance and resource discovery indicate it is required.
const SKILL_RESOURCE_DIRECTORY_CANDIDATES_BY_KIND = {
  scripts: [AGENT_SKILL_SCRIPTS_DIRECTORY_NAME],
  references: [
    AGENT_SKILL_REFERENCES_DIRECTORY_NAME,
    AGENT_SKILL_RESOURCES_DIRECTORY_NAME,
  ],
  assets: [
    AGENT_SKILL_ASSETS_DIRECTORY_NAME,
    AGENT_SKILL_RESOURCES_DIRECTORY_NAME,
  ],
} as const;

const fsConstants = nodeFs.constants;

type Dirent = import("node:fs").Dirent;

type ListedSkillResourceFiles = {
  files: SkillResourceFileEntry[];
  truncated: boolean;
};

type PendingDirectory = {
  absolutePath: string;
  relativePath: string;
};

type SkillResourceDirectoryResolution = {
  name: string;
  absolutePath: string;
};

export type SkillResourceKind = keyof typeof SKILL_RESOURCE_DIRECTORY_BY_KIND;

export type SkillResourceFileEntry = {
  path: string;
  sizeBytes: number;
};

export type SkillResourceManifest = {
  skillRoot: string;
  scripts: SkillResourceFileEntry[];
  references: SkillResourceFileEntry[];
  assets: SkillResourceFileEntry[];
  scriptsTruncated: boolean;
  referencesTruncated: boolean;
  assetsTruncated: boolean;
};

export async function inspectSkillResourceManifest(
  skillLocation: string,
): Promise<SkillResourceManifest> {
  const normalizedLocation = skillLocation.trim();
  if (!normalizedLocation) {
    throw new Error("Skill location is required.");
  }

  if (path.basename(normalizedLocation) !== "SKILL.md") {
    throw new Error("Skill location must point to SKILL.md.");
  }

  const skillRoot = path.dirname(normalizedLocation);
  const [scriptsResult, referencesResult, assetsResult] = await Promise.all([
    listSkillResourceFiles(skillRoot, "scripts"),
    listSkillResourceFiles(skillRoot, "references"),
    listSkillResourceFiles(skillRoot, "assets"),
  ]);

  return {
    skillRoot,
    scripts: scriptsResult.files,
    references: referencesResult.files,
    assets: assetsResult.files,
    scriptsTruncated: scriptsResult.truncated,
    referencesTruncated: referencesResult.truncated,
    assetsTruncated: assetsResult.truncated,
  };
}

export async function readSkillResourceText(options: {
  skillRoot: string;
  kind: "references" | "assets";
  relativePath: string;
  maxBytes?: number;
}): Promise<string> {
  const absolutePath = await resolveSkillResourceFilePath(
    options.skillRoot,
    options.kind,
    options.relativePath,
  );
  const maxBytes = normalizeMaxBytes(options.maxBytes, options.kind);
  const fileStats = await nodeFsPromises.stat(absolutePath);
  if (fileStats.size > maxBytes) {
    throw new Error(`Skill ${options.kind} file exceeds ${maxBytes} bytes.`);
  }

  return await nodeFsPromises.readFile(absolutePath, "utf8");
}

export async function readSkillResourceBuffer(options: {
  skillRoot: string;
  kind: "assets";
  relativePath: string;
  maxBytes?: number;
}): Promise<Buffer> {
  const absolutePath = await resolveSkillResourceFilePath(
    options.skillRoot,
    options.kind,
    options.relativePath,
  );
  const maxBytes = normalizeMaxBytes(options.maxBytes, options.kind);
  const fileStats = await nodeFsPromises.stat(absolutePath);
  if (fileStats.size > maxBytes) {
    throw new Error(`Skill ${options.kind} file exceeds ${maxBytes} bytes.`);
  }

  return await nodeFsPromises.readFile(absolutePath);
}

export async function resolveSkillResourceFilePath(
  skillRoot: string,
  kind: SkillResourceKind,
  relativePath: string,
): Promise<string> {
  const resourceDirectories = await resolveSkillResourceDirectories(
    skillRoot,
    kind,
  );
  if (resourceDirectories.length === 0) {
    throw new Error(buildSkillMissingDirectoryError(kind));
  }

  const normalizedRelativePath = normalizeSkillRelativePath(relativePath);
  const relativePathSegments = normalizedRelativePath.split("/");
  let lastError: unknown = null;

  for (const resourceDirectory of resourceDirectories) {
    const candidateRelativePath = normalizeSkillRelativePathForDirectory(
      relativePathSegments,
      kind,
      resourceDirectory.name,
    );
    const candidatePath = path.resolve(
      resourceDirectory.absolutePath,
      candidateRelativePath,
    );
    if (!isPathWithin(candidatePath, resourceDirectory.absolutePath)) {
      throw new Error(`Skill ${kind} path must stay inside the skill directory.`);
    }

    try {
      await assertReadableSkillResourcePath(
        candidatePath,
        resourceDirectory.absolutePath,
        kind,
      );
      return candidatePath;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error(`Skill ${kind} path was not found.`);
}

async function listSkillResourceFiles(
  skillRoot: string,
  kind: SkillResourceKind,
): Promise<ListedSkillResourceFiles> {
  const baseDirectories = await resolveSkillResourceDirectories(skillRoot, kind);
  if (baseDirectories.length === 0) {
    return {
      files: [],
      truncated: false,
    };
  }

  const files: SkillResourceFileEntry[] = [];
  const seenFilePaths = new Set<string>();
  const pendingDirectories: PendingDirectory[] = baseDirectories.map(
    (directory) => ({
      absolutePath: directory.absolutePath,
      relativePath: "",
    }),
  );
  let truncated = false;

  while (pendingDirectories.length > 0) {
    const currentDirectory = pendingDirectories.shift();
    if (!currentDirectory) {
      continue;
    }

    let entries: Dirent[];
    try {
      entries = await nodeFsPromises.readdir(currentDirectory.absolutePath, {
        withFileTypes: true,
      });
    } catch {
      continue;
    }

    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        continue;
      }

      const childRelativePath = joinRelativePath(
        currentDirectory.relativePath,
        entry.name,
      );
      const childAbsolutePath = path.join(
        currentDirectory.absolutePath,
        entry.name,
      );

      if (entry.isDirectory()) {
        pendingDirectories.push({
          absolutePath: childAbsolutePath,
          relativePath: childRelativePath,
        });
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const fileStats = await nodeFsPromises
        .stat(childAbsolutePath)
        .catch(() => null);
      if (!fileStats || !fileStats.isFile()) {
        continue;
      }

      if (seenFilePaths.has(childRelativePath)) {
        continue;
      }
      seenFilePaths.add(childRelativePath);

      files.push({
        path: childRelativePath,
        sizeBytes: fileStats.size,
      });

      if (files.length >= AGENT_SKILL_RESOURCE_MAX_FILES_PER_DIRECTORY) {
        truncated = true;
        break;
      }
    }

    if (truncated) {
      break;
    }
  }

  files.sort((left, right) => left.path.localeCompare(right.path));
  return {
    files,
    truncated,
  };
}

async function assertReadableSkillResourcePath(
  candidatePath: string,
  scopeDirectory: string,
  kind: SkillResourceKind,
): Promise<void> {
  await nodeFsPromises.access(candidatePath, fsConstants.R_OK);

  const fileStats = await nodeFsPromises.lstat(candidatePath);
  if (fileStats.isSymbolicLink()) {
    throw new Error(`Skill ${kind} path cannot be a symbolic link.`);
  }

  if (!fileStats.isFile()) {
    throw new Error(`Skill ${kind} path must target a file.`);
  }

  const [scopeDirectoryRealPath, candidateRealPath] = await Promise.all([
    nodeFsPromises.realpath(scopeDirectory).catch(() => scopeDirectory),
    nodeFsPromises.realpath(candidatePath).catch(() => candidatePath),
  ]);

  if (!isPathWithin(candidateRealPath, scopeDirectoryRealPath)) {
    throw new Error(`Skill ${kind} path must stay inside the skill directory.`);
  }
}

async function resolveSkillResourceDirectories(
  skillRoot: string,
  kind: SkillResourceKind,
): Promise<SkillResourceDirectoryResolution[]> {
  const normalizedSkillRoot = skillRoot.trim();
  if (!normalizedSkillRoot) {
    throw new Error("Skill root is required.");
  }

  const directoryNames = SKILL_RESOURCE_DIRECTORY_CANDIDATES_BY_KIND[kind];
  const resolutions = await Promise.all(
    directoryNames.map(async (directoryName) => {
      const absolutePath = path.resolve(normalizedSkillRoot, directoryName);
      const exists = await directoryExists(absolutePath);
      return {
        name: directoryName,
        absolutePath,
        exists,
      };
    }),
  );

  return resolutions
    .filter((resolution) => resolution.exists)
    .map((resolution) => ({
      name: resolution.name,
      absolutePath: resolution.absolutePath,
    }));
}

function buildSkillMissingDirectoryError(kind: SkillResourceKind): string {
  const names = SKILL_RESOURCE_DIRECTORY_CANDIDATES_BY_KIND[kind];
  if (names.length === 1) {
    return `Skill does not include ${names[0]} directory.`;
  }

  return `Skill does not include ${names.join(" or ")} directory.`;
}

function normalizeSkillRelativePathForDirectory(
  pathSegments: string[],
  kind: SkillResourceKind,
  directoryName: string,
): string {
  const canonicalDirectoryName = SKILL_RESOURCE_DIRECTORY_BY_KIND[kind];
  const relativeSegments =
    pathSegments[0] === canonicalDirectoryName || pathSegments[0] === directoryName
      ? pathSegments.slice(1)
      : pathSegments;
  if (relativeSegments.length === 0) {
    throw new Error("Skill path must target a file.");
  }

  return path.join(...relativeSegments);
}

function normalizeSkillRelativePath(value: string): string {
  const normalized = value.replace(/\\/g, "/").trim();
  if (!normalized) {
    throw new Error("Skill path is required.");
  }

  if (normalized.length > AGENT_SKILL_RESOURCE_PATH_MAX_LENGTH) {
    throw new Error(
      `Skill path must be ${AGENT_SKILL_RESOURCE_PATH_MAX_LENGTH} characters or fewer.`,
    );
  }

  if (normalized.startsWith("/")) {
    throw new Error("Skill path must be relative.");
  }

  const segments = normalized.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error("Skill path contains invalid segments.");
  }

  return normalized;
}

function normalizeMaxBytes(
  value: number | undefined,
  kind: "references" | "assets",
): number {
  const fallback =
    kind === "references"
      ? AGENT_SKILL_REFERENCE_FILE_MAX_BYTES
      : AGENT_SKILL_ASSET_FILE_MAX_BYTES;
  if (!Number.isFinite(value) || !Number.isSafeInteger(value) || !value || value <= 0) {
    return fallback;
  }

  return Math.min(value, fallback);
}

function joinRelativePath(parent: string, child: string): string {
  return parent ? `${parent}/${child}` : child;
}

function isPathWithin(targetPath: string, basePath: string): boolean {
  const relativePath = path.relative(basePath, targetPath);
  if (!relativePath) {
    return true;
  }

  return !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

async function directoryExists(location: string): Promise<boolean> {
  try {
    const locationStat = await nodeFsPromises.stat(location);
    return locationStat.isDirectory();
  } catch {
    return false;
  }
}
