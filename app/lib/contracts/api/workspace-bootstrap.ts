import type {
  WorkspaceSkillProfile as WorkspaceSkillProfileResource,
  WorkspaceSkillRegistryProfile as WorkspaceSkillRegistryProfileResource,
} from "@prisma/client";
import type {
  ApiErrorResponseBody,
  ApiSuccessResponseBody,
} from "~/lib/contracts/api/response";
import type { WorkspaceMcpServerProfileResource } from "~/lib/contracts/mcp/profile";
import type { ThreadResource } from "~/lib/contracts/threads/types";

export type WorkspaceBootstrapData = {
  tenantId: string;
  principalId: string;
  principal: unknown;
  azureProjects: unknown;
  azureTenants: unknown;
  azureSelection: unknown;
  azureDeploymentsByProjectId: Record<string, unknown>;
  threads: ThreadResource[];
  workspaceMcpServerProfiles: WorkspaceMcpServerProfileResource[];
  skills: unknown;
  skillRegistries: unknown;
  workspaceSkillProfiles?: WorkspaceSkillProfileResource[];
  workspaceSkillRegistryProfiles?: WorkspaceSkillRegistryProfileResource[];
  skillWarnings: string[];
  registryWarnings: string[];
  warnings: string[];
  desktopStatus: null;
};

export type WorkspaceBootstrapResponseBody =
  | ApiSuccessResponseBody<WorkspaceBootstrapData>
  | ApiErrorResponseBody;
