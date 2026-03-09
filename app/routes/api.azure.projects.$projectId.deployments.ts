/**
 * API route module for /api/azure/projects/:projectId/deployments.
 */
import {
  handleAzureProjectDeploymentLoader,
} from "~/lib/server/http/azure/azure-project-deployment-loader";
import {
  installGlobalServerErrorLogging,
} from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import {
  createAzureProjectQueryServiceWithInfrastructure,
} from "~/lib/server/infrastructure/azure/azure-service-factory";
import type { Route } from "./+types/api.azure.projects.$projectId.deployments";

export async function loader({ request, params }: Route.LoaderArgs) {
  installGlobalServerErrorLogging();
  return handleAzureProjectDeploymentLoader({
    request,
    projectId: params.projectId,
    azureProjectQueryService: createAzureProjectQueryServiceWithInfrastructure(),
  });
}
