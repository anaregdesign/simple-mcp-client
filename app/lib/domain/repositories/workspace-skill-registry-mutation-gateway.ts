import type { SkillRegistryId } from "~/lib/contracts/skills/registry";

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
