import type { AzureSessionGateway } from "~/lib/domain/repositories/azure-session-gateway";
import {
  getAzureDependencies,
  resetAzureDependencies,
} from "~/lib/server/infrastructure/azure/dependencies";

export function createAzureSessionGateway(): AzureSessionGateway {
  return {
    authenticate: async (scope, tenantId) => {
      await getAzureDependencies().authenticateAzure(scope, tenantId);
    },
    reset: () => {
      resetAzureDependencies();
    },
  };
}
