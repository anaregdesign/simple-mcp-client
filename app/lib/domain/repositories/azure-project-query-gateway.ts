import type {
  AzureOpenAIDeploymentCapabilitySource,
  AzureOpenAIModelCapabilitySource,
} from "~/lib/domain/value-objects/azure-openai-model-capabilities";

export type AzureOpenAIProjectReference = {
  subscriptionId: string;
  resourceGroup: string;
  accountName: string;
};

export type AzureOpenAIAccountRecord = {
  subscriptionId: string;
  resourceGroup: string;
  accountName: string;
  baseUrl: string;
};

export type AzureTenantRecord = {
  tenantId: string;
  displayName: string;
  defaultDomain: string;
};

export type AzureOpenAIDeploymentRecord = {
  name: string;
  capability: AzureOpenAIDeploymentCapabilitySource;
};

export interface AzureProjectQueryGateway {
  listAzureOpenAIAccounts(accessToken: string): Promise<AzureOpenAIAccountRecord[]>;
  listAzureTenants(
    accessToken: string,
    abortSignal?: AbortSignal,
  ): Promise<AzureTenantRecord[]>;
  listAzureProjectDeployments(
    accessToken: string,
    projectRef: AzureOpenAIProjectReference,
  ): Promise<AzureOpenAIDeploymentRecord[]>;
  listAzureProjectModels(
    accessToken: string,
    projectRef: AzureOpenAIProjectReference,
  ): Promise<AzureOpenAIModelCapabilitySource[]>;
}
