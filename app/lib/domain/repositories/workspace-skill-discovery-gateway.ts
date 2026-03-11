import type { SkillRegistryId } from "~/lib/domain/value-objects/skill-registry";

export type SkillCatalogSource = "workspace" | "codex_home" | "app_data";

export type SkillCatalogEntry = {
  name: string;
  description: string;
  location: string;
  source: SkillCatalogSource;
};

export type SkillRegistrySkillEntry = {
  id: string;
  name: string;
  description: string;
  tag: string | null;
  remotePath: string;
  installLocation: string;
  isInstalled: boolean;
  isUpdateAvailable: boolean;
};

export type SkillRegistryCatalog = {
  registryId: SkillRegistryId;
  registryLabel: string;
  registryDescription: string;
  repository: string;
  repositoryUrl: string;
  sourcePath: string;
  skills: SkillRegistrySkillEntry[];
};

export type WorkspaceSkillCatalogDiscovery = {
  skills: SkillCatalogEntry[];
  warnings: string[];
};

export type WorkspaceSkillRegistryDiscovery = {
  catalogs: SkillRegistryCatalog[];
  warnings: string[];
};

export interface WorkspaceSkillDiscoveryGateway {
  discoverCatalog(options: {
    workspaceUserId: number;
  }): Promise<WorkspaceSkillCatalogDiscovery>;
  discoverRegistries(options: {
    workspaceUserId: number;
    forceRefresh: boolean;
  }): Promise<WorkspaceSkillRegistryDiscovery>;
}
