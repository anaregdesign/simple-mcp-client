import type {
  ApiErrorResponseBody,
  ApiSuccessResponseBody,
} from "~/lib/contracts/api/response";
import type {
  AzureDeploymentResource,
  AzurePrincipalProfileResource,
  AzureProjectResource,
  AzureSelectionPreferenceResource,
  AzureTenantResource,
} from "~/lib/contracts/api/azure";
import type { WorkspaceMcpServerProfileResource } from "~/lib/contracts/mcp/profile";
import type {
  SkillCatalogEntry,
  SkillRegistryCatalog,
} from "~/lib/contracts/skills/types";
import type {
  WorkspaceSkillProfileResource,
  WorkspaceSkillRegistryProfileResource,
} from "~/lib/contracts/skills/workspace-skill-profiles";
import type { ThreadResource } from "~/lib/contracts/threads/types";

export type WorkspaceBootstrapData = {
  tenantId: string;
  principalId: string;
  principal: AzurePrincipalProfileResource | null;
  azureProjects: AzureProjectResource[];
  azureTenants: AzureTenantResource[];
  azureSelection: AzureSelectionPreferenceResource | null;
  azureDeploymentsByProjectId: Record<string, AzureDeploymentResource[]>;
  threads: ThreadResource[];
  workspaceMcpServerProfiles: WorkspaceMcpServerProfileResource[];
  skills: SkillCatalogEntry[];
  skillRegistries: SkillRegistryCatalog[];
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
