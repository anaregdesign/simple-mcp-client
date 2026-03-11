import {
  authRequiredResponse,
  errorResponse,
  methodNotAllowedResponse,
  readErrorMessage,
} from "~/lib/server/infrastructure/http/route-transport";
import {
  presentAzurePrincipalProfileResource,
  presentAzureProjectResources,
  presentAzureTenantResources,
} from "~/lib/server/infrastructure/azure/azure-presentation";
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

const AZURE_PROJECTS_ALLOWED_METHODS = ["GET"] as const;
const AZURE_PROJECTS_ROUTE_PATH = "/api/azure/projects";

export async function handleAzureProjectCollectionLoader(options: {
  request: Request;
  azureProjectQueryService: AzureProjectQueryService;
}): Promise<Response> {
  const { request, azureProjectQueryService } = options;

  if (request.method !== "GET") {
    return methodNotAllowedResponse(AZURE_PROJECTS_ALLOWED_METHODS);
  }

  const requestedTenantId =
    new URL(request.url).searchParams.get("tenantId")?.trim() ?? "";
  const tokenResult = await getArmAccessToken(undefined, requestedTenantId);
  if (!tokenResult.ok) {
    return authRequiredResponse();
  }

  const principal = await resolveAzurePrincipalProfile(tokenResult);

  try {
    const [projects, tenants] = await Promise.all([
      azureProjectQueryService.loadAzureProjectsWithFallback(tokenResult.token),
      azureProjectQueryService.loadAzureTenantsWithFallback(
        tokenResult.token,
        tokenResult.tenantId,
      ),
    ]);

    return Response.json({
      projects: presentAzureProjectResources(projects),
      tenants: presentAzureTenantResources(tenants),
      principal: presentAzurePrincipalProfileResource(principal),
      tenantId: tokenResult.tenantId,
      principalId: tokenResult.principalId,
      authRequired: false,
    });
  } catch (error) {
    if (isLikelyAzureAuthError(error)) {
      await logServerRouteEvent({
        request,
        route: AZURE_PROJECTS_ROUTE_PATH,
        eventName: "azure_auth_required",
        action: "list_projects",
        level: "warning",
        statusCode: 401,
        error,
      });

      return authRequiredResponse();
    }

    await logServerRouteEvent({
      request,
      route: AZURE_PROJECTS_ROUTE_PATH,
      eventName: "load_azure_projects_failed",
      action: "list_projects",
      statusCode: 502,
      error,
    });

    return errorResponse({
      status: 502,
      code: "load_azure_projects_failed",
      error: `Failed to load Azure project data: ${readErrorMessage(error)}`,
    });
  }
}
