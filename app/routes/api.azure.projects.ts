/**
 * API route module for /api/azure/projects.
 */
import {
  parseReasoningEffortOptionsFromString,
  resolveReasoningEffortOptionsByModelName,
} from "~/lib/domain/value-objects/azure-openai-model-capabilities";
import {
  isLikelyAzureAuthError,
} from "~/lib/server/usecase/azure/azure-project-service";
import {
  getArmAccessToken,
} from "~/lib/server/infrastructure/azure/arm-access-context";
import {
  handleAzureProjectCollectionLoader,
} from "~/lib/server/infrastructure/azure/azure-project-collection-loader";
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
};

export async function loader({ request }: Route.LoaderArgs) {
  installGlobalServerErrorLogging();
  return handleAzureProjectCollectionLoader({
    request,
    azureProjectQueryService: createAzureProjectQueryServiceWithInfrastructure(),
  });
}
