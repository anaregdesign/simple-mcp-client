import type { WorkspaceBootstrapData } from "~/lib/contracts/api/workspace-bootstrap";
import {
  methodNotAllowedResponse,
  structuredAuthRequiredResponse,
  structuredErrorResponse,
  successResponse,
} from "~/lib/server/http";
import {
  presentAzureDeploymentsByProjectIdResource,
  presentAzurePrincipalProfileResource,
  presentAzureProjectResources,
  presentAzureSelectionPreferenceResource,
  presentAzureTenantResources,
} from "~/lib/server/http/azure/azure-presentation";
import { presentThreadResources } from "~/lib/server/infrastructure/threads/thread-resource-presentation";
import { readAuthenticatedWorkspaceUser } from "~/lib/server/infrastructure/auth/read-authenticated-user";
import { logServerRouteEvent } from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import type { WorkspaceBootstrapService } from "~/lib/server/usecase/workspace/workspace-bootstrap-service";

const WORKSPACE_BOOTSTRAP_ALLOWED_METHODS = ["GET"] as const;
const WORKSPACE_BOOTSTRAP_ROUTE_PATH = "/api/workspace-bootstrap";

export async function handleWorkspaceBootstrapLoader(options: {
  request: Request;
  workspaceBootstrapService: WorkspaceBootstrapService;
}): Promise<Response> {
  const { request, workspaceBootstrapService } = options;

  if (request.method !== "GET") {
    return methodNotAllowedResponse(WORKSPACE_BOOTSTRAP_ALLOWED_METHODS);
  }

  const user = await readAuthenticatedWorkspaceUser();
  if (!user) {
    return structuredAuthRequiredResponse();
  }

  try {
    const data = await workspaceBootstrapService.loadWorkspaceBootstrap({
      user,
    });
    if (!data) {
      return structuredAuthRequiredResponse();
    }

    const responseData: WorkspaceBootstrapData = {
      ...data,
      principal: presentAzurePrincipalProfileResource(data.principal),
      azureProjects: presentAzureProjectResources(data.azureProjects),
      azureTenants: presentAzureTenantResources(data.azureTenants),
      azureSelection: presentAzureSelectionPreferenceResource(
        data.azureSelection,
      ),
      azureDeploymentsByProjectId: presentAzureDeploymentsByProjectIdResource(
        data.azureDeploymentsByProjectId,
      ),
      threads: presentThreadResources(data.threads),
    };

    return successResponse(responseData);
  } catch (error) {
    await logServerRouteEvent({
      request,
      route: WORKSPACE_BOOTSTRAP_ROUTE_PATH,
      eventName: "load_workspace_bootstrap_failed",
      action: "load_workspace_bootstrap",
      statusCode: 500,
      error,
    });

    return structuredErrorResponse({
      status: 500,
      code: "load_workspace_bootstrap_failed",
      message:
        error instanceof Error && error.message.trim()
          ? error.message
          : "Failed to load workspace bootstrap data.",
    });
  }
}
