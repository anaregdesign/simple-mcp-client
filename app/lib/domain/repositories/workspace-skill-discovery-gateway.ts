import type {
  SkillCatalogEntry,
  SkillRegistryCatalog,
} from "~/lib/contracts/skills/types";

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
