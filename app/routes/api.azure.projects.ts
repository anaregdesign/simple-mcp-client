/**
 * API route module for /api/azure/projects.
 */
import { createAzureArmPagedFetchGateway } from "~/lib/server/infrastructure/gateways/azure/arm-paged-fetch-gateway";
import {
  createAzureProjectQueryService,
  isLikelyAzureAuthError,
  parseReasoningEffortOptionsFromString,
  resolveReasoningEffortOptionsByModelName,
} from "~/lib/server/usecase/azure/azure-project-service";
import {
  getArmAccessToken,
} from "~/lib/server/infrastructure/azure/arm-access-context";
import {
  handleAzureProjectCollectionLoader,
} from "~/lib/server/http/azure/azure-project-collection-loader";
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

function getAzureProjectQueryService() {
  return createAzureProjectQueryService({
    logEvent: logServerRouteEvent,
    armPagedFetchGateway: createAzureArmPagedFetchGateway(),
  });
}

export async function loader({ request }: Route.LoaderArgs) {
  installGlobalServerErrorLogging();
  return handleAzureProjectCollectionLoader({
    request,
    azureProjectQueryService: getAzureProjectQueryService(),
  });
}
