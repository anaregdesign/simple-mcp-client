import {
  createAzureSessionGateway,
} from "~/lib/server/infrastructure/gateways/azure/azure-session-gateway";
import {
  createAzureArmPagedFetchGateway,
} from "~/lib/server/infrastructure/gateways/azure/arm-paged-fetch-gateway";
import {
  logServerRouteEvent,
} from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import {
  createAzureSelectionPreferencePersistenceRepository,
} from "~/lib/server/infrastructure/repositories/azure-selection-preference-persistence-repository";
import {
  createAzureProjectQueryService,
} from "~/lib/server/usecase/azure/azure-project-service";
import {
  createAzureSelectionService,
} from "~/lib/server/usecase/azure/azure-selection-service";
import {
  createAzureSessionService,
} from "~/lib/server/usecase/azure/azure-session-service";

export function createAzureProjectQueryServiceWithInfrastructure() {
  return createAzureProjectQueryService({
    logEvent: logServerRouteEvent,
    armPagedFetchGateway: createAzureArmPagedFetchGateway(),
  });
}

export function createAzureSelectionServiceWithInfrastructure() {
  return createAzureSelectionService(
    createAzureSelectionPreferencePersistenceRepository(),
  );
}

export function createAzureSessionServiceWithInfrastructure() {
  return createAzureSessionService(createAzureSessionGateway());
}
