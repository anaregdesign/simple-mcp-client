import nodeCrypto from "node:crypto";
import {
  SKILL_REGISTRY_LIST_CACHE_TTL_MS,
  SKILL_REGISTRY_TREE_CACHE_TTL_MS,
} from "~/lib/constants/skills";
import {
  AGENT_SKILL_NAME_PATTERN,
  parseSkillRegistrySkillName,
  type SkillRegistryId,
  type SkillRegistryOption,
} from "~/lib/domain/value-objects/skill-registry";
import {
  ensurePersistenceDatabaseReady,
  prisma,
} from "~/lib/server/infrastructure/persistence/prisma";
import type {
  GithubContentsDirectoryEntry,
  ReadRegistrySkillBlobEntriesOptions,
  ReadRegistryVersionChecksumOptions,
  RegistryBlobEntry,
  RegistryCatalogSkill,
} from "~/lib/server/infrastructure/gateways/skills/skill-registry-gateway-types";
import { normalizeRepoPath, readErrorMessage } from "~/lib/server/infrastructure/gateways/skills/skill-registry-storage";

const GITHUB_API_BASE_URL = "https://api.github.com";
const GITHUB_RAW_BASE_URL = "https://raw.githubusercontent.com";
const REGISTRY_LIST_CACHE_KEY_PREFIX = "skill_registry_list:";
const REGISTRY_TREE_CACHE_KEY_PREFIX = "skill_registry_tree:";
const CACHE_VERSION = "v1";

export async function readRegistrySkills(
  registry: SkillRegistryOption,
  options: { forceRefresh?: boolean } = {},
): Promise<RegistryCatalogSkill[]> {
  if (registry.skillPathLayout === "tagged") {
    return await readTaggedRepositorySkills(registry, options);
  }

  const cacheKey = buildRegistryListCacheKey(registry);
  return await readCacheValue(
    cacheKey,
    async () => {
      const payload = await fetchJson(
        buildRepositoryContentsApiUrl({
          repository: registry.repository,
          ref: registry.ref,
          contentPath: registry.sourcePath,
        }),
      );
      const skills = readSkillNamesFromContentsPayload(payload).map(
        (skillName) => ({
          id: skillName,
          name: skillName,
          tag: null,
        }),
      );
      if (skills.length === 0) {
        throw new Error(
          `No installable Skill directories were found for ${registry.label}.`,
        );
      }

      return skills;
    },
    SKILL_REGISTRY_LIST_CACHE_TTL_MS,
    { forceRefresh: options.forceRefresh },
  );
}

export async function readRegistrySkillBlobEntries(
  options: ReadRegistrySkillBlobEntriesOptions,
): Promise<RegistryBlobEntry[]> {
  const blobEntries = await readRegistryBlobEntries(options.registry, {
    forceRefresh: options.forceRefresh,
  });
  const skillPrefix = `${options.sourceRootPath}/${options.skillPath}/`;
  const matchingBlobEntries = blobEntries
    .filter((blobEntry) => blobEntry.path.startsWith(skillPrefix))
    .sort((left, right) => left.path.localeCompare(right.path));

  if (matchingBlobEntries.length === 0) {
    throw new Error(
      `Skill "${options.skillPath}" was not found in ${options.registry.label}.`,
    );
  }

  return matchingBlobEntries;
}

export async function readRegistryVersionChecksumBySkillPath(
  options: ReadRegistryVersionChecksumOptions,
): Promise<Map<string, string>> {
  const blobEntries = await readRegistryBlobEntries(options.registry, {
    forceRefresh: options.forceRefresh,
  });
  const blobEntriesBySkillPath = new Map<string, RegistryBlobEntry[]>();

  for (const blobEntry of blobEntries) {
    const skillPath = readRegistrySkillPathFromBlobPath({
      registry: options.registry,
      sourceRootPath: options.sourceRootPath,
      blobPath: blobEntry.path,
    });
    if (!skillPath) {
      continue;
    }

    const current = blobEntriesBySkillPath.get(skillPath) ?? [];
    current.push(blobEntry);
    blobEntriesBySkillPath.set(skillPath, current);
  }

  const checksumBySkillPath = new Map<string, string>();
  for (const [skillPath, skillBlobEntries] of blobEntriesBySkillPath.entries()) {
    checksumBySkillPath.set(
      skillPath,
      buildVersionChecksumFromBlobEntries(skillBlobEntries),
    );
  }

  return checksumBySkillPath;
}

export async function fetchRegistryFileBytes(options: {
  registry: SkillRegistryOption;
  filePath: string;
}): Promise<ArrayBuffer> {
  return await fetchBytes(
    buildRawFileUrl({
      repository: options.registry.repository,
      ref: options.registry.ref,
      filePath: options.filePath,
    }),
  );
}

export async function invalidateSkillRegistryListCache(
  registryId: SkillRegistryId,
): Promise<void> {
  await ensurePersistenceDatabaseReady();
  const listPrefix = `${REGISTRY_LIST_CACHE_KEY_PREFIX}${CACHE_VERSION}:${registryId}:`;
  await prisma.skillRegistryCache.deleteMany({
    where: {
      cacheKey: {
        startsWith: listPrefix,
      },
    },
  });
}

export function buildRepositoryUrl(repository: string): string {
  return `https://github.com/${repository}`;
}

export function readSkillNamesFromContentsPayload(payload: unknown): string[] {
  if (!Array.isArray(payload)) {
    throw new Error("Unexpected registry listing response.");
  }

  const names = new Set<string>();
  for (const entry of payload) {
    const normalizedEntry = readGithubContentsDirectoryEntry(entry);
    if (!normalizedEntry || normalizedEntry.type !== "dir") {
      continue;
    }

    const normalizedName = normalizeSkillName(normalizedEntry.name);
    if (normalizedName) {
      names.add(normalizedName);
    }
  }

  return Array.from(names).sort((left, right) => left.localeCompare(right));
}

export function readBlobEntriesFromTreePayload(
  payload: unknown,
): RegistryBlobEntry[] {
  if (!isRecord(payload)) {
    throw new Error("Unexpected git tree response.");
  }

  if (payload.truncated === true) {
    throw new Error("Git tree response is truncated. Narrow the source path.");
  }

  const tree = payload.tree;
  if (!Array.isArray(tree)) {
    throw new Error("Git tree payload is invalid.");
  }

  const blobEntries = new Map<string, string>();
  for (const entry of tree) {
    if (!isRecord(entry)) {
      continue;
    }

    const type = typeof entry.type === "string" ? entry.type.trim() : "";
    const blobPath =
      typeof entry.path === "string" ? normalizeRepoPath(entry.path) : "";
    const blobSha = typeof entry.sha === "string" ? entry.sha.trim() : "";
    if (type === "blob" && blobPath && blobSha) {
      blobEntries.set(blobPath, blobSha);
    }
  }

  return Array.from(blobEntries.entries())
    .map(([blobPath, blobSha]) => ({
      path: blobPath,
      sha: blobSha,
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

export function readRegistrySkillPathFromBlobPath(options: {
  registry: SkillRegistryOption;
  sourceRootPath: string;
  blobPath: string;
}): string | null {
  const sourcePrefix = `${options.sourceRootPath}/`;
  if (!options.blobPath.startsWith(sourcePrefix)) {
    return null;
  }

  const relativePath = options.blobPath.slice(sourcePrefix.length);
  const segments = relativePath
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  if (segments.length < 2) {
    return null;
  }

  const rawSkillPath =
    options.registry.skillPathLayout === "tagged"
      ? segments.length >= 3
        ? `${segments[0]}/${segments[1]}`
        : ""
      : segments[0];
  if (!rawSkillPath) {
    return null;
  }

  const parsed = parseSkillRegistrySkillName(options.registry.id, rawSkillPath);
  return parsed ? parsed.normalizedSkillName : null;
}

export function buildVersionChecksumFromBlobEntries(
  blobEntries: RegistryBlobEntry[],
): string {
  const checksumHash = nodeCrypto.createHash("sha256");
  const sortedBlobEntries = [...blobEntries].sort((left, right) =>
    left.path.localeCompare(right.path),
  );
  for (const blobEntry of sortedBlobEntries) {
    checksumHash.update(blobEntry.path);
    checksumHash.update(":");
    checksumHash.update(blobEntry.sha);
    checksumHash.update("\n");
  }
  return checksumHash.digest("hex");
}

export function buildRegistryListCacheKey(
  registry: SkillRegistryOption,
): string {
  return `${REGISTRY_LIST_CACHE_KEY_PREFIX}${CACHE_VERSION}:${registry.id}:${registry.repository}:${registry.ref}:${registry.sourcePath}`;
}

export function buildRegistryTreeCacheKey(
  registry: SkillRegistryOption,
): string {
  return `${REGISTRY_TREE_CACHE_KEY_PREFIX}${CACHE_VERSION}:${registry.id}:${registry.repository}:${registry.ref}`;
}

export function normalizeSkillName(value: string): string {
  const normalized = value.trim();
  if (!normalized || !AGENT_SKILL_NAME_PATTERN.test(normalized)) {
    return "";
  }

  return normalized;
}

async function readTaggedRepositorySkills(
  registry: SkillRegistryOption,
  options: { forceRefresh?: boolean } = {},
): Promise<RegistryCatalogSkill[]> {
  const cacheKey = buildRegistryListCacheKey(registry);
  return await readCacheValue(
    cacheKey,
    async () => {
      const blobEntries = await readRegistryBlobEntries(registry, {
        forceRefresh: options.forceRefresh,
      });
      const sourceRootPath = normalizeRepoPath(registry.sourcePath);
      const sourcePrefix = `${sourceRootPath}/`;
      const skills = new Map<string, RegistryCatalogSkill>();

      for (const blobEntry of blobEntries) {
        if (!blobEntry.path.startsWith(sourcePrefix)) {
          continue;
        }

        const relativePath = blobEntry.path.slice(sourcePrefix.length);
        const segments = relativePath
          .split("/")
          .map((segment) => segment.trim())
          .filter((segment) => segment.length > 0);
        if (segments.length !== 3) {
          continue;
        }

        const [tag, skillName, fileName] = segments;
        if (!tag || !skillName || fileName !== "SKILL.md") {
          continue;
        }

        const parsed = parseSkillRegistrySkillName(
          registry.id,
          `${tag}/${skillName}`,
        );
        if (!parsed) {
          continue;
        }

        skills.set(parsed.normalizedSkillName, {
          id: parsed.normalizedSkillName,
          name: parsed.skillName,
          tag: parsed.tag,
        });
      }

      const sortedSkills = Array.from(skills.values()).sort((left, right) => {
        const leftTag = left.tag ?? "";
        const rightTag = right.tag ?? "";
        const byTag = leftTag.localeCompare(rightTag);
        if (byTag !== 0) {
          return byTag;
        }

        return left.name.localeCompare(right.name);
      });
      if (sortedSkills.length === 0) {
        throw new Error(
          `No installable Skill directories were found for ${registry.label}.`,
        );
      }

      return sortedSkills;
    },
    SKILL_REGISTRY_LIST_CACHE_TTL_MS,
    { forceRefresh: options.forceRefresh },
  );
}

async function readRegistryBlobEntries(
  registry: SkillRegistryOption,
  options: { forceRefresh?: boolean } = {},
): Promise<RegistryBlobEntry[]> {
  const cacheKey = buildRegistryTreeCacheKey(registry);
  return await readCacheValue(
    cacheKey,
    async () => {
      const payload = await fetchJson(
        buildRepositoryTreeApiUrl({
          repository: registry.repository,
          ref: registry.ref,
        }),
      );
      return readBlobEntriesFromTreePayload(payload);
    },
    SKILL_REGISTRY_TREE_CACHE_TTL_MS,
    { forceRefresh: options.forceRefresh },
  );
}

function buildRepositoryContentsApiUrl(options: {
  repository: string;
  ref: string;
  contentPath: string;
}): string {
  return `${GITHUB_API_BASE_URL}/repos/${options.repository}/contents/${encodeRepoPath(
    options.contentPath,
  )}?ref=${encodeURIComponent(options.ref)}`;
}

function buildRepositoryTreeApiUrl(options: {
  repository: string;
  ref: string;
}): string {
  return `${GITHUB_API_BASE_URL}/repos/${options.repository}/git/trees/${encodeURIComponent(
    options.ref,
  )}?recursive=1`;
}

function buildRawFileUrl(options: {
  repository: string;
  ref: string;
  filePath: string;
}): string {
  return `${GITHUB_RAW_BASE_URL}/${options.repository}/${encodeURIComponent(options.ref)}/${encodeRepoPath(
    options.filePath,
  )}`;
}

function encodeRepoPath(value: string): string {
  return normalizeRepoPath(value)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function readGithubContentsDirectoryEntry(
  value: unknown,
): GithubContentsDirectoryEntry | null {
  if (!isRecord(value)) {
    return null;
  }

  const name = typeof value.name === "string" ? value.name.trim() : "";
  const type = typeof value.type === "string" ? value.type.trim() : "";
  if (!name || !type) {
    return null;
  }

  return { name, type };
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    method: "GET",
    headers: buildGitHubRequestHeaders(),
  });
  if (!response.ok) {
    throw new Error(`GitHub API request failed (${response.status}).`);
  }

  return await response.json();
}

async function fetchBytes(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url, {
    method: "GET",
    headers: buildGitHubRequestHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Skill file download failed (${response.status}).`);
  }

  return await response.arrayBuffer();
}

function buildGitHubRequestHeaders(): HeadersInit {
  const token = [process.env.GITHUB_TOKEN, process.env.GH_TOKEN]
    .map((candidate) => (typeof candidate === "string" ? candidate.trim() : ""))
    .find((candidate) => candidate.length > 0);

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "local-playground-skill-registry",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function readCacheValue<T>(
  cacheKey: string,
  load: () => Promise<T>,
  ttlMs: number,
  options: { forceRefresh?: boolean } = {},
): Promise<T> {
  if (!options.forceRefresh) {
    const cached = await readCachedPayload<T>(cacheKey);
    if (cached !== null) {
      return cached;
    }
  }

  const loaded = await load();
  await writeCachedPayload(cacheKey, loaded, ttlMs);
  return loaded;
}

async function readCachedPayload<T>(cacheKey: string): Promise<T | null> {
  await ensurePersistenceDatabaseReady();
  const row = await prisma.skillRegistryCache.findUnique({
    where: { cacheKey },
  });
  if (!row) {
    return null;
  }

  const expiresAtTime = Date.parse(row.expiresAt);
  if (Number.isNaN(expiresAtTime) || expiresAtTime <= Date.now()) {
    await prisma.skillRegistryCache
      .delete({ where: { cacheKey } })
      .catch(() => undefined);
    return null;
  }

  try {
    return JSON.parse(row.payloadJson) as T;
  } catch {
    await prisma.skillRegistryCache
      .delete({ where: { cacheKey } })
      .catch(() => undefined);
    return null;
  }
}

async function writeCachedPayload<T>(
  cacheKey: string,
  payload: T,
  ttlMs: number,
): Promise<void> {
  await ensurePersistenceDatabaseReady();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + Math.max(1_000, ttlMs));
  await prisma.skillRegistryCache.upsert({
    where: { cacheKey },
    create: {
      cacheKey,
      payloadJson: JSON.stringify(payload),
      updatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    },
    update: {
      payloadJson: JSON.stringify(payload),
      updatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
