/**
 * Azure session application service module.
 */
import { AZURE_ARM_SCOPE } from "~/lib/constants/azure";
import { ensureDefaultMcpServersForUser } from "~/lib/server/application/mcp/mcp-server-profile-service";
import { readAzureArmUserContext } from "~/lib/server/auth/azure-user";
import {
  AZURE_COGNITIVE_SERVICES_SCOPE,
  getAzureDependencies,
  resetAzureDependencies,
} from "~/lib/server/infrastructure/azure/dependencies";
import { getOrCreateUserByIdentity } from "~/lib/server/persistence/user";

export class AzureSessionService {
  async startSession(
    requestedTenantId: string,
  ): Promise<{ tenantId: string; principalId: string; userId: number }> {
    const preferredTenantId = requestedTenantId.trim();

    resetAzureDependencies();
    const dependencies = getAzureDependencies();
    if (preferredTenantId) {
      await dependencies.authenticateAzure(AZURE_ARM_SCOPE, preferredTenantId);
    } else {
      await dependencies.authenticateAzure(AZURE_ARM_SCOPE);
    }

    const identity = await readAzureArmUserContext(dependencies, preferredTenantId);
    if (!identity) {
      throw new Error("Azure token does not include tenant or principal claims.");
    }
    if (
      preferredTenantId &&
      identity.tenantId.toLowerCase() !== preferredTenantId.toLowerCase()
    ) {
      throw new Error(
        `Azure tenant switch did not complete. Requested tenant: ${preferredTenantId}, resolved tenant: ${identity.tenantId}.`,
      );
    }

    await this.ensureAzureCognitiveTokenForTenant(identity.tenantId);

    const user = await getOrCreateUserByIdentity({
      tenantId: identity.tenantId,
      principalId: identity.principalId,
    });
    await ensureDefaultMcpServersForUser(user.id);

    return {
      tenantId: identity.tenantId,
      principalId: identity.principalId,
      userId: user.id,
    };
  }

  endSession(): void {
    resetAzureDependencies();
  }

  private async ensureAzureCognitiveTokenForTenant(tenantId: string): Promise<void> {
    const dependencies = getAzureDependencies();
    try {
      await dependencies.getAzureBearerToken(AZURE_COGNITIVE_SERVICES_SCOPE, tenantId);
    } catch (error) {
      if (!isTenantMismatchError(error)) {
        throw error;
      }
      await dependencies.authenticateAzure(AZURE_COGNITIVE_SERVICES_SCOPE, tenantId);
    }
  }
}

export const azureSessionService = new AzureSessionService();

function isTenantMismatchError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return message.includes("azure credential returned tenant") && message.includes("requested");
}
