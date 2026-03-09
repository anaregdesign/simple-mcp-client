import type {
  SkillCatalogEntry,
  SkillRegistryCatalog,
} from "~/lib/contracts/skills/types";
import type {
  WorkspaceSkillProfilesData,
} from "~/lib/contracts/skills/workspace-skill-profiles";

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
