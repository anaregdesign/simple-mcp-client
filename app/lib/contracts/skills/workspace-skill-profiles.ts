import type {
  ApiErrorResponseBody,
  ApiSuccessResponseBody,
} from "~/lib/contracts/api/response";

export type ReconcileWorkspaceSkillProfilesCommand = {
  forceRefresh?: boolean;
};

export type WorkspaceSkillProfilesData = {
  workspaceSkillProfiles: unknown;
  workspaceSkillRegistryProfiles: unknown;
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
};

export type ReconcileWorkspaceSkillProfilesResponseBody =
  | ApiSuccessResponseBody<ReconcileWorkspaceSkillProfilesData>
  | ApiErrorResponseBody;
