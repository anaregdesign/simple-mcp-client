import { parseProjectId } from "~/lib/contracts/api/azure-project-id";
import {
  authRequiredResponse,
  errorResponse,
  methodNotAllowedResponse,
  readErrorMessage,
  validationErrorResponse,
} from "~/lib/server/http";
import {
  presentAzureDeploymentResources,
  presentAzurePrincipalProfileResource,
} from "~/lib/server/http/azure/azure-presentation";
import {
  getArmAccessToken,
  resolveAzurePrincipalProfile,
} from "~/lib/server/infrastructure/azure/arm-access-context";
import {
  logServerRouteEvent,
} from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import {
  isLikelyAzureAuthError,
  type AzureProjectQueryService,
} from "~/lib/server/usecase/azure/azure-project-service";

const AZURE_PROJECT_DEPLOYMENTS_ALLOWED_METHODS = ["GET"] as const;
const AZURE_PROJECT_DEPLOYMENTS_ROUTE_PATH =
  "/api/azure/projects/:projectId/deployments";

export async function handleAzureProjectDeploymentLoader(options: {
  request: Request;
  projectId: string | undefined;
  azureProjectQueryService: AzureProjectQueryService;
}): Promise<Response> {
  const { request, projectId, azureProjectQueryService } = options;

  if (request.method !== "GET") {
    return methodNotAllowedResponse(AZURE_PROJECT_DEPLOYMENTS_ALLOWED_METHODS);
  }

  const tokenResult = await getArmAccessToken();
  if (!tokenResult.ok) {
    return authRequiredResponse();
  }

  const normalizedProjectId = typeof projectId === "string" ? projectId.trim() : "";
  const projectRef = parseProjectId(normalizedProjectId);
  if (!projectRef) {
    await logServerRouteEvent({
      request,
      route: AZURE_PROJECT_DEPLOYMENTS_ROUTE_PATH,
      eventName: "invalid_project_id",
      action: "parse_project_id",
      level: "warning",
      statusCode: 422,
      message: "Invalid projectId.",
      context: {
        projectId: normalizedProjectId,
      },
    });

    return validationErrorResponse("invalid_project_id", "Invalid projectId.");
  }

  const principal = await resolveAzurePrincipalProfile(tokenResult);

  try {
    const deployments = await azureProjectQueryService.listProjectDeployments(
      tokenResult.token,
      projectRef,
    );

    return Response.json({
      deployments: presentAzureDeploymentResources(deployments),
      principal: presentAzurePrincipalProfileResource(principal),
      tenantId: tokenResult.tenantId,
      principalId: tokenResult.principalId,
      authRequired: false,
    });
  } catch (error) {
    if (isLikelyAzureAuthError(error)) {
      await logServerRouteEvent({
        request,
        route: AZURE_PROJECT_DEPLOYMENTS_ROUTE_PATH,
        eventName: "azure_auth_required",
        action: "list_deployments",
        level: "warning",
        statusCode: 401,
        error,
        context: {
          projectId: normalizedProjectId,
        },
      });

      return authRequiredResponse();
    }

    await logServerRouteEvent({
      request,
      route: AZURE_PROJECT_DEPLOYMENTS_ROUTE_PATH,
      eventName: "load_azure_deployments_failed",
      action: "list_deployments",
      statusCode: 502,
      error,
      context: {
        projectId: normalizedProjectId,
      },
    });

    return errorResponse({
      status: 502,
      code: "load_azure_deployments_failed",
      error: `Failed to load Azure deployment data: ${readErrorMessage(error)}`,
    });
  }
}
