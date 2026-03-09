/**
 * API route module for /api/azure/projects/:projectId/deployments.
 */
import { createAzureArmPagedFetchGateway } from "~/lib/server/infrastructure/gateways/azure/arm-paged-fetch-gateway";
import {
  handleAzureProjectDeploymentLoader,
} from "~/lib/server/http/azure/azure-project-deployment-loader";
import {
  installGlobalServerErrorLogging,
  logServerRouteEvent,
} from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import {
  createAzureProjectQueryService,
} from "~/lib/server/usecase/azure/azure-project-service";
import type { Route } from "./+types/api.azure.projects.$projectId.deployments";

function getAzureProjectQueryService() {
  return createAzureProjectQueryService({
    logEvent: logServerRouteEvent,
    armPagedFetchGateway: createAzureArmPagedFetchGateway(),
  });
}

export async function loader({ request, params }: Route.LoaderArgs) {
  installGlobalServerErrorLogging();
  return handleAzureProjectDeploymentLoader({
    request,
    projectId: params.projectId,
    azureProjectQueryService: getAzureProjectQueryService(),
  });
}
