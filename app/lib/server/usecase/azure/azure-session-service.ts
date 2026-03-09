/**
 * Azure session application service module.
 */
import { AZURE_ARM_SCOPE } from "~/lib/constants/azure";
import { getAzureDependencies, resetAzureDependencies } from "~/lib/server/infrastructure/azure/dependencies";

export class AzureSessionService {
  async startSession(requestedTenantId: string): Promise<void> {
    const preferredTenantId = requestedTenantId.trim();

    resetAzureDependencies();
    const dependencies = getAzureDependencies();
    if (preferredTenantId) {
      await dependencies.authenticateAzure(AZURE_ARM_SCOPE, preferredTenantId);
    } else {
      await dependencies.authenticateAzure(AZURE_ARM_SCOPE);
    }
  }

  endSession(): void {
    resetAzureDependencies();
  }
}

export const azureSessionService = new AzureSessionService();
