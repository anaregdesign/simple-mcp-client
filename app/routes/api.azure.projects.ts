/**
 * API route module for /api/azure/projects.
 */
import {
  createAzureProjectQueryService,
  isLikelyAzureAuthError,
  parseReasoningEffortOptionsFromString,
  readErrorMessage,
  resolveReasoningEffortOptionsByModelName,
} from "~/lib/server/usecase/azure/azure-project-service";
import {
  getArmAccessToken,
  resolveAzurePrincipalProfile,
} from "~/lib/server/infrastructure/azure/arm-access-context";
import {
  authRequiredResponse,
  errorResponse,
  methodNotAllowedResponse,
} from "~/lib/server/http";
import {
  presentAzurePrincipalProfileResource,
  presentAzureProjectResources,
  presentAzureTenantResources,
} from "~/lib/server/http/azure/azure-presentation";
import {
  installGlobalServerErrorLogging,
  logServerRouteEvent,
} from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import type { Route } from "./+types/api.azure.projects";

export {
  getArmAccessToken,
  isLikelyAzureAuthError,
  parseReasoningEffortOptionsFromString,
  resolveReasoningEffortOptionsByModelName,
};

const AZURE_PROJECTS_ALLOWED_METHODS = ["GET"] as const;
const AZURE_PROJECTS_ROUTE = "/api/azure/projects";

function getAzureProjectQueryService() {
  return createAzureProjectQueryService(logServerRouteEvent);
}

export async function loader({ request }: Route.LoaderArgs) {
  installGlobalServerErrorLogging();

  if (request.method !== "GET") {
    return methodNotAllowedResponse(AZURE_PROJECTS_ALLOWED_METHODS);
  }

  const requestedTenantId = new URL(request.url).searchParams.get("tenantId")?.trim() ?? "";
  const tokenResult = await getArmAccessToken(undefined, requestedTenantId);
  if (!tokenResult.ok) {
    return authRequiredResponse();
  }

  const principal = await resolveAzurePrincipalProfile(tokenResult);

  try {
    const [projects, tenants] = await Promise.all([
      getAzureProjectQueryService().loadAzureProjectsWithFallback(request, tokenResult.token),
      getAzureProjectQueryService().loadAzureTenantsWithFallback(
        request,
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
        route: AZURE_PROJECTS_ROUTE,
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
      route: AZURE_PROJECTS_ROUTE,
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
