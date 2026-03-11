/**
 * Azure session application service module.
 */
import { AZURE_ARM_SCOPE } from "~/lib/constants/azure";
import type { AzureSessionGateway } from "~/lib/domain/repositories/azure-session-gateway";

export class AzureSessionService {
  constructor(
    private readonly gateway: AzureSessionGateway,
  ) {}

  async startSession(requestedTenantId: string): Promise<void> {
    const preferredTenantId = requestedTenantId.trim();

    this.gateway.reset();
    if (preferredTenantId) {
      await this.gateway.authenticate(AZURE_ARM_SCOPE, preferredTenantId);
    } else {
      await this.gateway.authenticate(AZURE_ARM_SCOPE);
    }
  }

  endSession(): void {
    this.gateway.reset();
  }
}

export function createAzureSessionService(
  gateway: AzureSessionGateway,
): AzureSessionService {
  return new AzureSessionService(gateway);
}
