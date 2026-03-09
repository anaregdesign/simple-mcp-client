/**
 * API route module for /api/azure/projects.
 */
import {
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
} from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import {
  createAzureProjectQueryServiceWithInfrastructure,
} from "~/lib/server/infrastructure/azure/azure-service-factory";
import type { Route } from "./+types/api.azure.projects";

export {
  getArmAccessToken,
  isLikelyAzureAuthError,
  parseReasoningEffortOptionsFromString,
  resolveReasoningEffortOptionsByModelName,
};

export async function loader({ request }: Route.LoaderArgs) {
  installGlobalServerErrorLogging();
  return handleAzureProjectCollectionLoader({
    request,
    azureProjectQueryService: createAzureProjectQueryServiceWithInfrastructure(),
  });
}
