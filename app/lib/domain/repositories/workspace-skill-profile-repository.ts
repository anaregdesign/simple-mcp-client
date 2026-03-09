import type {
  SkillCatalogEntry,
  SkillRegistryCatalog,
} from "~/lib/domain/entities/skill-catalog";
import type {
  WorkspaceSkillProfilesData,
} from "~/lib/domain/entities/workspace-skill-profile";

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
