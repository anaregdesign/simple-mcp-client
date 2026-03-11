import {
  normalizeAzureOpenAIBaseURL,
} from "~/lib/domain/value-objects/chat-azure-config";
import type {
  AzureOpenAIDeploymentCapabilitySource,
  AzureOpenAIModelCapabilitySource,
} from "~/lib/domain/value-objects/azure-openai-model-capabilities";
import type {
  AzureArmPagedFetchGateway,
  AzureArmPagedFetchLogEvent,
} from "~/lib/domain/repositories/azure-arm-paged-fetch-gateway";
import type {
  AzureOpenAIAccountRecord,
  AzureOpenAIDeploymentRecord,
  AzureOpenAIProjectReference,
  AzureProjectQueryGateway,
  AzureTenantRecord,
} from "~/lib/domain/repositories/azure-project-query-gateway";
import {
  AZURE_COGNITIVE_API_VERSION,
  AZURE_MAX_ACCOUNTS_PER_SUBSCRIPTION,
  AZURE_MAX_DEPLOYMENTS_PER_ACCOUNT,
  AZURE_MAX_MODELS_PER_ACCOUNT,
  AZURE_MAX_SUBSCRIPTIONS,
  AZURE_MAX_TENANTS,
  AZURE_SUBSCRIPTIONS_API_VERSION,
  AZURE_TENANTS_API_VERSION,
} from "~/lib/constants/azure";

const AZURE_SUBSCRIPTION_ACCOUNT_FETCH_CONCURRENCY = 6;
const AZURE_PROJECT_QUERY_LOG_LOCATION = "azure_project_query_gateway";

type ArmSubscription = {
  subscriptionId?: string;
  state?: string;
};

type ArmTenant = {
  id?: string;
  tenantId?: string;
  displayName?: string;
  defaultDomain?: string;
};

type ArmCognitiveAccount = {
  id?: string;
  name?: string;
  kind?: string;
  properties?: {
    endpoint?: string;
  };
};

type ArmModelInfo = {
  name?: string;
  version?: string;
  format?: string;
  capabilities?: Record<string, unknown>;
};

type ArmCognitiveDeployment = {
  name?: string;
  properties?: {
    provisioningState?: string;
    model?: ArmModelInfo;
  };
};

type ArmAccountModel = {
  model?: ArmModelInfo;
};

class AzureProjectQueryGatewayImpl implements AzureProjectQueryGateway {
  constructor(
    private readonly logEvent: AzureArmPagedFetchLogEvent,
    private readonly armPagedFetchGateway: AzureArmPagedFetchGateway,
  ) {}

  async listAzureOpenAIAccounts(
    accessToken: string,
  ): Promise<AzureOpenAIAccountRecord[]> {
    const subscriptions =
      await this.armPagedFetchGateway.fetchPaged<ArmSubscription>({
        url: `https://management.azure.com/subscriptions?api-version=${AZURE_SUBSCRIPTIONS_API_VERSION}`,
        accessToken,
        maxItems: AZURE_MAX_SUBSCRIPTIONS,
        logEvent: this.logEvent,
      });

    const enabledSubscriptionIds = subscriptions
      .map((subscription) => {
        const subscriptionId =
          typeof subscription.subscriptionId === "string"
            ? subscription.subscriptionId.trim()
            : "";
        const subscriptionState =
          typeof subscription.state === "string"
            ? subscription.state.toLowerCase()
            : "";
        if (
          !subscriptionId ||
          (subscriptionState && subscriptionState !== "enabled")
        ) {
          return "";
        }

        return subscriptionId;
      })
      .filter(Boolean);

    return (
      await mapWithConcurrency(
        enabledSubscriptionIds,
        AZURE_SUBSCRIPTION_ACCOUNT_FETCH_CONCURRENCY,
        async (subscriptionId): Promise<AzureOpenAIAccountRecord[]> => {
          let accounts: ArmCognitiveAccount[];
          try {
            accounts =
              await this.armPagedFetchGateway.fetchPaged<ArmCognitiveAccount>({
                url: `https://management.azure.com/subscriptions/${encodeURIComponent(subscriptionId)}/providers/Microsoft.CognitiveServices/accounts?api-version=${AZURE_COGNITIVE_API_VERSION}`,
                accessToken,
                maxItems: AZURE_MAX_ACCOUNTS_PER_SUBSCRIPTION,
                logEvent: this.logEvent,
              });
          } catch (error) {
            await this.logEvent({
              route: AZURE_PROJECT_QUERY_LOG_LOCATION,
              eventName: "list_accounts_failed",
              action: "list_subscription_accounts",
              level: "warning",
              error,
              context: {
                subscriptionId,
              },
            });
            return [];
          }

          const projects: AzureOpenAIAccountRecord[] = [];
          for (const account of accounts) {
            if (!isAzureOpenAIProject(account)) {
              continue;
            }

            const accountName =
              typeof account.name === "string" ? account.name.trim() : "";
            const accountId =
              typeof account.id === "string" ? account.id.trim() : "";
            if (!accountName || !accountId) {
              continue;
            }

            const resourceGroup = parseResourceGroupFromResourceId(accountId);
            if (!resourceGroup) {
              continue;
            }

            const endpoint =
              typeof account.properties?.endpoint === "string" &&
              account.properties.endpoint.trim()
                ? account.properties.endpoint
                : `https://${accountName}.openai.azure.com/`;
            const baseUrl = normalizeAzureOpenAIBaseURL(endpoint);
            if (!baseUrl) {
              continue;
            }

            projects.push({
              subscriptionId,
              resourceGroup,
              accountName,
              baseUrl,
            });
          }

          return projects;
        },
      )
    ).flat();
  }

  async listAzureTenants(
    accessToken: string,
    abortSignal?: AbortSignal,
  ): Promise<AzureTenantRecord[]> {
    const discovered = await this.armPagedFetchGateway.fetchPaged<ArmTenant>({
      url: `https://management.azure.com/tenants?api-version=${AZURE_TENANTS_API_VERSION}`,
      accessToken,
      maxItems: AZURE_MAX_TENANTS,
      logEvent: this.logEvent,
      abortSignal,
    });

    const tenantsById = new Map<string, AzureTenantRecord>();
    for (const tenant of discovered) {
      const tenantId = readArmTenantId(tenant);
      if (!tenantId) {
        continue;
      }
      const tenantKey = tenantId.toLowerCase();
      const defaultDomain =
        typeof tenant.defaultDomain === "string"
          ? tenant.defaultDomain.trim()
          : "";
      const displayNameRaw =
        typeof tenant.displayName === "string" ? tenant.displayName.trim() : "";
      const displayName = displayNameRaw || defaultDomain || tenantId;
      const existing = tenantsById.get(tenantKey);
      if (existing && existing.defaultDomain && existing.displayName) {
        continue;
      }

      tenantsById.set(tenantKey, {
        tenantId,
        displayName,
        defaultDomain,
      });
    }

    return [...tenantsById.values()].sort((left, right) =>
      left.displayName.localeCompare(right.displayName),
    );
  }

  async listAzureProjectDeployments(
    accessToken: string,
    projectRef: AzureOpenAIProjectReference,
  ): Promise<AzureOpenAIDeploymentRecord[]> {
    const deployments =
      await this.armPagedFetchGateway.fetchPaged<ArmCognitiveDeployment>({
        url: `https://management.azure.com/subscriptions/${encodeURIComponent(projectRef.subscriptionId)}/resourceGroups/${encodeURIComponent(projectRef.resourceGroup)}/providers/Microsoft.CognitiveServices/accounts/${encodeURIComponent(projectRef.accountName)}/deployments?api-version=${AZURE_COGNITIVE_API_VERSION}`,
        accessToken,
        maxItems: AZURE_MAX_DEPLOYMENTS_PER_ACCOUNT,
        logEvent: this.logEvent,
      });

    return deployments
      .map((deployment) => {
        const name =
          typeof deployment.name === "string" ? deployment.name.trim() : "";
        if (!name) {
          return null;
        }

        return {
          name,
          capability: {
            provisioningState:
              typeof deployment.properties?.provisioningState === "string"
                ? deployment.properties.provisioningState
                : "",
            model: mapArmModelInfo(deployment.properties?.model),
          } satisfies AzureOpenAIDeploymentCapabilitySource,
        };
      })
      .filter((deployment): deployment is AzureOpenAIDeploymentRecord =>
        deployment !== null,
      );
  }

  async listAzureProjectModels(
    accessToken: string,
    projectRef: AzureOpenAIProjectReference,
  ): Promise<AzureOpenAIModelCapabilitySource[]> {
    try {
      const models = await this.armPagedFetchGateway.fetchPaged<ArmAccountModel>(
        {
          url: `https://management.azure.com/subscriptions/${encodeURIComponent(projectRef.subscriptionId)}/resourceGroups/${encodeURIComponent(projectRef.resourceGroup)}/providers/Microsoft.CognitiveServices/accounts/${encodeURIComponent(projectRef.accountName)}/models?api-version=${AZURE_COGNITIVE_API_VERSION}`,
          accessToken,
          maxItems: AZURE_MAX_MODELS_PER_ACCOUNT,
          logEvent: this.logEvent,
        },
      );

      return models.map((entry) => ({
        model: mapArmModelInfo(entry.model),
      }));
    } catch (error) {
      await this.logEvent({
        route: AZURE_PROJECT_QUERY_LOG_LOCATION,
        eventName: "list_account_models_failed",
        action: "list_account_models",
        level: "warning",
        error,
        context: {
          subscriptionId: projectRef.subscriptionId,
          resourceGroup: projectRef.resourceGroup,
          accountName: projectRef.accountName,
        },
      });
      return [];
    }
  }
}

export function createAzureProjectQueryGateway(options: {
  logEvent: AzureArmPagedFetchLogEvent;
  armPagedFetchGateway: AzureArmPagedFetchGateway;
}): AzureProjectQueryGateway {
  return new AzureProjectQueryGatewayImpl(
    options.logEvent,
    options.armPagedFetchGateway,
  );
}

function isAzureOpenAIProject(account: ArmCognitiveAccount): boolean {
  const kind =
    typeof account.kind === "string" ? account.kind.toLowerCase() : "";
  const endpoint =
    typeof account.properties?.endpoint === "string"
      ? account.properties.endpoint.toLowerCase()
      : "";

  return (
    kind === "openai" ||
    kind === "aiservices" ||
    endpoint.includes(".openai.azure.com") ||
    endpoint.includes(".services.ai.azure.com")
  );
}

function parseResourceGroupFromResourceId(resourceId: string): string {
  const match = resourceId.match(/\/resourceGroups\/([^/]+)/i);
  return match?.[1] ?? "";
}

function readArmTenantId(tenant: ArmTenant): string {
  const tenantId =
    typeof tenant.tenantId === "string" ? tenant.tenantId.trim() : "";
  if (tenantId) {
    return tenantId;
  }

  const resourceId = typeof tenant.id === "string" ? tenant.id.trim() : "";
  const match = resourceId.match(/\/tenants\/([^/]+)/i);
  return match?.[1]?.trim() ?? "";
}

function mapArmModelInfo(
  model: ArmModelInfo | undefined,
): AzureOpenAIModelCapabilitySource["model"] {
  if (!model) {
    return null;
  }

  return {
    name: typeof model.name === "string" ? model.name : "",
    version: typeof model.version === "string" ? model.version : "",
    format: typeof model.format === "string" ? model.format : "",
    capabilities:
      model.capabilities && typeof model.capabilities === "object"
        ? model.capabilities
        : {},
  };
}

async function mapWithConcurrency<TItem, TResult>(
  items: TItem[],
  concurrency: number,
  mapper: (item: TItem, index: number) => Promise<TResult>,
): Promise<TResult[]> {
  if (items.length === 0) {
    return [];
  }

  const normalizedConcurrency = Math.max(
    1,
    Math.min(items.length, concurrency),
  );
  const results = new Array<TResult>(items.length);
  let currentIndex = 0;

  await Promise.all(
    Array.from({ length: normalizedConcurrency }, async () => {
      while (currentIndex < items.length) {
        const targetIndex = currentIndex;
        currentIndex += 1;
        results[targetIndex] = await mapper(items[targetIndex], targetIndex);
      }
    }),
  );

  return results;
}
