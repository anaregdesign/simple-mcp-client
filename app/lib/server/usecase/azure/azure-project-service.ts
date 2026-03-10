/**
 * Azure project query service module.
 */
import type {
  AzureOpenAIProjectReference,
  AzureProjectQueryGateway,
} from "~/lib/domain/repositories/azure-project-query-gateway";
import { type AzureProjectRef } from "~/lib/contracts/api/azure-project-id";
import {
  type AzureDeployment,
  type AzureProject,
  type AzureTenant,
  prioritizeActiveTenant,
  selectAzureDeploymentList,
  selectAzureProjectList,
} from "~/lib/server/usecase/azure/azure-project-selectors";
import {
  isLikelyAzureAuthError,
  readAzureProjectErrorMessage,
} from "~/lib/server/usecase/azure/azure-project-errors";

export class AzureProjectQueryService {
  constructor(private readonly queryGateway: AzureProjectQueryGateway) {}

  async loadAzureProjectsWithFallback(
    accessToken: string,
  ): Promise<AzureProject[]> {
    try {
      return await this.listAzureProjects(accessToken);
    } catch {
      return [];
    }
  }

  async loadAzureTenantsWithFallback(
    accessToken: string,
    activeTenantId: string,
  ): Promise<AzureTenant[]> {
    try {
      const tenants = await this.queryGateway.listAzureTenants(accessToken);
      return prioritizeActiveTenant(tenants, activeTenantId);
    } catch {
      return activeTenantId
        ? [
            {
              tenantId: activeTenantId,
              displayName: activeTenantId,
              defaultDomain: "",
            },
          ]
        : [];
    }
  }

  async listProjectDeployments(
    accessToken: string,
    projectRef: AzureProjectRef,
  ): Promise<AzureDeployment[]> {
    const normalizedProjectRef = toAzureOpenAIProjectReference(projectRef);
    const [deployments, accountModels] = await Promise.all([
      this.queryGateway.listAzureProjectDeployments(
        accessToken,
        normalizedProjectRef,
      ),
      this.queryGateway.listAzureProjectModels(accessToken, normalizedProjectRef),
    ]);
    return selectAzureDeploymentList(deployments, accountModels);
  }

  private async listAzureProjects(accessToken: string): Promise<AzureProject[]> {
    return selectAzureProjectList(
      await this.queryGateway.listAzureOpenAIAccounts(accessToken),
    );
  }
}

export function createAzureProjectQueryService(options: {
  queryGateway: AzureProjectQueryGateway;
}): AzureProjectQueryService {
  return new AzureProjectQueryService(options.queryGateway);
}

function toAzureOpenAIProjectReference(
  projectRef: AzureProjectRef,
): AzureOpenAIProjectReference {
  return {
    subscriptionId: projectRef.subscriptionId,
    resourceGroup: projectRef.resourceGroup,
    accountName: projectRef.accountName,
  };
}
export type { AzureDeployment, AzureProject, AzureTenant };
export { isLikelyAzureAuthError };
export const readErrorMessage = readAzureProjectErrorMessage;
