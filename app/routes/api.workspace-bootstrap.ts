import { structuredAuthRequiredResponse, structuredErrorResponse, methodNotAllowedResponse, successResponse } from "~/lib/server/http";
import type { WorkspaceBootstrapData } from "~/lib/contracts/api/workspace-bootstrap";
import { readAuthenticatedWorkspaceUser } from "~/lib/server/infrastructure/auth/read-authenticated-user";
import {
  createWorkspaceBootstrapService,
} from "~/lib/server/usecase/workspace/workspace-bootstrap-service";
import {
  createAzureSelectionService,
} from "~/lib/server/usecase/azure/azure-selection-service";
import {
  createMcpServerProfileService,
} from "~/lib/server/usecase/mcp/mcp-server-profile-service";
import {
  createThreadQueryService,
} from "~/lib/server/usecase/threads/thread-service";
import {
  createWorkspaceSkillService,
} from "~/lib/server/usecase/skills/workspace-skill-service";
import {
  createAzureArmAccessGateway,
} from "~/lib/server/infrastructure/azure/arm-access-context";
import {
  createAzureSelectionPreferencePersistenceRepository,
} from "~/lib/server/infrastructure/repositories/azure-selection-preference-persistence-repository";
import {
  createAzureProjectQueryService,
} from "~/lib/server/usecase/azure/azure-project-service";
import {
  createWorkspaceMcpServerProfilePersistenceRepository,
} from "~/lib/server/infrastructure/repositories/workspace-mcp-server-profile-persistence-repository";
import {
  createThreadPersistenceRepository,
} from "~/lib/server/infrastructure/repositories/thread-persistence-repository";
import {
  createWorkspaceSkillProfilePersistenceRepository,
} from "~/lib/server/infrastructure/repositories/workspace-skill-profile-persistence-repository";
import {
  createWorkspaceSkillDiscoveryGateway,
} from "~/lib/server/infrastructure/gateways/skills/skill-discovery-gateway";
import {
  installGlobalServerErrorLogging,
  logServerRouteEvent,
} from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import {
  presentAzureDeploymentsByProjectIdResource,
  presentAzurePrincipalProfileResource,
  presentAzureProjectResources,
  presentAzureSelectionPreferenceResource,
  presentAzureTenantResources,
} from "~/lib/server/http/azure/azure-presentation";
import { presentThreadResources } from "~/lib/server/usecase/threads/thread-resource-presentation";
import type { Route } from "./+types/api.workspace-bootstrap";

const WORKSPACE_BOOTSTRAP_ALLOWED_METHODS = ["GET"] as const;

function getWorkspaceBootstrapService() {
  return createWorkspaceBootstrapService({
    azureArmAccessGateway: createAzureArmAccessGateway(),
    azureProjectQueryService: createAzureProjectQueryService(logServerRouteEvent),
    azureSelectionService: createAzureSelectionService(
      createAzureSelectionPreferencePersistenceRepository(),
    ),
    mcpServerProfileService: createMcpServerProfileService(
      createWorkspaceMcpServerProfilePersistenceRepository(),
    ),
    threadQueryService: createThreadQueryService(
      createThreadPersistenceRepository(),
    ),
    workspaceSkillService: createWorkspaceSkillService({
      repository: createWorkspaceSkillProfilePersistenceRepository(),
      discoveryGateway: createWorkspaceSkillDiscoveryGateway(),
    }),
  });
}

export async function loader({ request }: Route.LoaderArgs) {
  installGlobalServerErrorLogging();

  if (request.method !== "GET") {
    return methodNotAllowedResponse(WORKSPACE_BOOTSTRAP_ALLOWED_METHODS);
  }

  const user = await readAuthenticatedWorkspaceUser();
  if (!user) {
    return structuredAuthRequiredResponse();
  }

  try {
    const data = await getWorkspaceBootstrapService().loadWorkspaceBootstrap({
      request,
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
      route: "/api/workspace-bootstrap",
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
