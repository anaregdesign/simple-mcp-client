import type {
  WorkspaceSkillProfile as WorkspaceSkillProfileResource,
  WorkspaceSkillRegistryProfile as WorkspaceSkillRegistryProfileResource,
} from "@prisma/client";
import type {
  ApiErrorResponseBody,
  ApiSuccessResponseBody,
} from "~/lib/contracts/api/response";

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
