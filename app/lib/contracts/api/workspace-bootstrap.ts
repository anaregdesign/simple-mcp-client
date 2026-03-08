import type {
  ApiErrorResponseBody,
  ApiSuccessResponseBody,
} from "~/lib/contracts/api/response";

export type WorkspaceBootstrapData = {
  tenantId: string;
  principalId: string;
  principal: unknown;
  azureProjects: unknown;
  azureTenants: unknown;
  azureSelection: unknown;
  azureDeploymentsByProjectId: Record<string, unknown>;
  threads: unknown;
  workspaceMcpServerProfiles: unknown;
  skills: unknown;
  skillRegistries: unknown;
  skillWarnings: string[];
  registryWarnings: string[];
  warnings: string[];
  desktopStatus: null;
};

export type WorkspaceBootstrapResponseBody =
  | ApiSuccessResponseBody<WorkspaceBootstrapData>
  | ApiErrorResponseBody;
