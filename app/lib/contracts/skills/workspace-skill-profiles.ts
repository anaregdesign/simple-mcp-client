import type {
  ApiErrorResponseBody,
  ApiSuccessResponseBody,
} from "~/lib/contracts/api/response";

export type WorkspaceSkillRegistryProfileResource = {
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

export type WorkspaceSkillProfileResource = {
  id: number;
  userId: number;
  registryProfileId: number | null;
  name: string;
  location: string;
  source: string;
};

export type ReconcileWorkspaceSkillProfilesCommand = {
  forceRefresh?: boolean;
};

export type WorkspaceSkillProfilesData = {
  workspaceSkillProfiles: WorkspaceSkillProfileResource[];
  workspaceSkillRegistryProfiles: WorkspaceSkillRegistryProfileResource[];
};

export type WorkspaceSkillProfilesResponseBody =
  | ApiSuccessResponseBody<WorkspaceSkillProfilesData>
  | ApiErrorResponseBody;

export type ReconcileWorkspaceSkillProfilesData = {
  message: string;
  skills: unknown;
  skillRegistries: unknown;
  skillWarnings: string[];
  registryWarnings: string[];
  warnings: string[];
  workspaceSkillProfileCount: number;
  workspaceSkillRegistryProfileCount: number;
  workspaceSkillProfiles?: WorkspaceSkillProfileResource[];
  workspaceSkillRegistryProfiles?: WorkspaceSkillRegistryProfileResource[];
};

export type ReconcileWorkspaceSkillProfilesResponseBody =
  | ApiSuccessResponseBody<ReconcileWorkspaceSkillProfilesData>
  | ApiErrorResponseBody;
