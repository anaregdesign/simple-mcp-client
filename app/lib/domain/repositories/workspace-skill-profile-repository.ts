import type {
  SkillCatalogEntry,
  SkillCatalogSource,
  SkillRegistryCatalog,
} from "~/lib/domain/repositories/workspace-skill-discovery-gateway";
import type { SkillRegistryId } from "~/lib/domain/value-objects/skill-registry";

export type WorkspaceSkillRegistryProfile = {
  id: number;
  userId: number;
  registryId: SkillRegistryId;
  registryLabel: string;
  registryDescription: string;
  repository: string;
  repositoryUrl: string;
  sourcePath: string;
  installDirectoryName: string;
};

export type WorkspaceSkillProfile = {
  id: number;
  userId: number;
  registryProfileId: number | null;
  name: string;
  location: string;
  source: SkillCatalogSource;
};

export type WorkspaceSkillProfilesData = {
  workspaceSkillProfiles: WorkspaceSkillProfile[];
  workspaceSkillRegistryProfiles: WorkspaceSkillRegistryProfile[];
};

export type SyncWorkspaceSkillMastersResult = {
  workspaceSkillProfileCount: number;
  workspaceSkillRegistryProfileCount: number;
};

export interface WorkspaceSkillProfileRepository {
  readByUserId(userId: number): Promise<WorkspaceSkillProfilesData>;
  syncSkillMasters(options: {
    userId: number;
    skills: SkillCatalogEntry[];
    registries: SkillRegistryCatalog[];
  }): Promise<SyncWorkspaceSkillMastersResult>;
}
