export type WorkspaceSkillRegistryProfile = {
  id: number;
  userId: number;
  registryId: string;
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
  source: string;
};

export type WorkspaceSkillProfilesData = {
  workspaceSkillProfiles: WorkspaceSkillProfile[];
  workspaceSkillRegistryProfiles: WorkspaceSkillRegistryProfile[];
};
