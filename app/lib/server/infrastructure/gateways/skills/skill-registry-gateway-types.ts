import type { SkillRegistryCatalog } from "~/lib/contracts/skills/types";
import type { SkillRegistryId, SkillRegistryOption } from "~/lib/domain/value-objects/skill-registry";

export type ResolveSkillRegistryOptions = {
  workspaceUserId: number;
  forceRefresh?: boolean;
  workspaceStorageDirectory?: string;
  platform?: NodeJS.Platform;
  homeDirectory?: string;
  appDataDirectory?: string | null;
};

export type SkillRegistryInstallOptions = ResolveSkillRegistryOptions & {
  registryId: SkillRegistryId;
  skillName: string;
};

export type SkillRegistryDeleteOptions = ResolveSkillRegistryOptions & {
  registryId: SkillRegistryId;
  skillName: string;
};

export type SkillRegistryCatalogDiscoveryResult = {
  catalogs: SkillRegistryCatalog[];
  warnings: string[];
};

export type SkillRegistryInstallResult = {
  skillName: string;
  installLocation: string;
  operation: "installed" | "updated" | "unchanged";
};

export type SkillRegistryDeleteResult = {
  skillName: string;
  installLocation: string;
  removed: boolean;
};

export type GithubContentsDirectoryEntry = {
  name: string;
  type: string;
};

export type RegistryBlobEntry = {
  path: string;
  sha: string;
};

export type RegistryCatalogSkill = {
  id: string;
  name: string;
  tag: string | null;
};

export type InstalledSkillMetadata = {
  formatVersion: number;
  registryId: string;
  sourcePath: string;
  skillName: string;
  skillPath: string;
  versionChecksum: string;
};

export type ReadSkillRegistryCatalogOptions = {
  appDataSkillsRoot: string;
  forceRefresh?: boolean;
};

export type ReadRegistrySkillBlobEntriesOptions = {
  registry: SkillRegistryOption;
  sourceRootPath: string;
  skillPath: string;
  forceRefresh?: boolean;
};

export type ReadRegistryVersionChecksumOptions = {
  registry: SkillRegistryOption;
  sourceRootPath: string;
  forceRefresh?: boolean;
};
