/**
 * API route module for /api/azure/projects.
 */
import {
  azureProjectQueryService,
  getArmAccessToken,
  isLikelyAzureAuthError,
  parseReasoningEffortOptionsFromString,
  readErrorMessage,
  resolveAzurePrincipalProfile,
  resolveReasoningEffortOptionsByModelName,
} from "~/lib/server/application/azure/azure-project-service";
import {
  authRequiredResponse,
  errorResponse,
  methodNotAllowedResponse,
} from "~/lib/server/http";
import {
  installGlobalServerErrorLogging,
  logServerRouteEvent,
} from "~/lib/server/observability/runtime-event-log";
import type { Route } from "./+types/api.azure.projects";

export {
  getArmAccessToken,
  isLikelyAzureAuthError,
  parseReasoningEffortOptionsFromString,
  resolveReasoningEffortOptionsByModelName,
};

const AZURE_PROJECTS_ALLOWED_METHODS = ["GET"] as const;
const AZURE_PROJECTS_ROUTE = "/api/azure/projects";

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
      azureProjectQueryService.loadAzureProjectsWithFallback(request, tokenResult.token),
      azureProjectQueryService.loadAzureTenantsWithFallback(
        request,
        tokenResult.token,
        tokenResult.tenantId,
      ),
    ]);

    return Response.json({
      projects,
      tenants,
      principal,
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
