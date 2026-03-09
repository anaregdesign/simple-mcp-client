import type { SkillRegistryId } from "~/lib/domain/value-objects/skill-registry-id";

export type WorkspaceSkillRegistryInstallResult = {
  skillName: string;
  installLocation: string;
  operation: "installed" | "updated" | "unchanged";
};

export type WorkspaceSkillRegistryDeleteResult = {
  skillName: string;
  installLocation: string;
  removed: boolean;
};

export interface WorkspaceSkillRegistryMutationGateway {
  installSkill(options: {
    workspaceUserId: number;
    registryId: SkillRegistryId;
    skillName: string;
  }): Promise<WorkspaceSkillRegistryInstallResult>;
  deleteSkill(options: {
    workspaceUserId: number;
    registryId: SkillRegistryId;
    skillName: string;
  }): Promise<WorkspaceSkillRegistryDeleteResult>;
}
