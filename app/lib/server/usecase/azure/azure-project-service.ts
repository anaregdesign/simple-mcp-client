/**
 * Azure project query service module.
 */
import {
  createProjectId,
  type AzureProjectRef,
} from "~/lib/contracts/api/azure-project-id";
import {
  normalizeAzureOpenAIBaseURL,
} from "~/lib/server/usecase/azure/azure-openai-url";
export {
  parseReasoningEffortOptionsFromString,
  resolveReasoningEffortOptionsByModelName,
} from "~/lib/server/usecase/azure/azure-project-deployment-capabilities";

import {
  buildModelCapabilitiesMap,
  createModelKey,
  isAgentsSdkCompatibleDeployment,
  isDeploymentSucceeded,
  mergeReasoningEffortOptions,
  resolveDeploymentReasoningEffortOptions,
  type ArmAccountModel,
  type ArmCognitiveDeployment,
} from "~/lib/server/usecase/azure/azure-project-deployment-capabilities";
import type {
  AzureArmPagedFetchGateway,
  AzureArmPagedFetchLogEvent,
} from "~/lib/domain/repositories/azure-arm-paged-fetch-gateway";
import {
  AZURE_COGNITIVE_API_VERSION,
  AZURE_MAX_ACCOUNTS_PER_SUBSCRIPTION,
  AZURE_MAX_DEPLOYMENTS_PER_ACCOUNT,
  AZURE_MAX_MODELS_PER_ACCOUNT,
  AZURE_MAX_SUBSCRIPTIONS,
  AZURE_MAX_TENANTS,
  AZURE_OPENAI_DEFAULT_API_VERSION,
  AZURE_SUBSCRIPTIONS_API_VERSION,
  AZURE_TENANTS_API_VERSION,
} from "~/lib/constants/azure";
import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";
const AZURE_SUBSCRIPTION_ACCOUNT_FETCH_CONCURRENCY = 6;
const AZURE_PROJECT_QUERY_LOG_LOCATION = "azure_project_query_service";

export type AzureProject = {
  id: string;
  projectName: string;
  baseUrl: string;
  apiVersion: string;
};

export type AzureDeployment = {
  name: string;
  reasoningEffortOptions: ReasoningEffort[];
};

export type AzureTenant = {
  tenantId: string;
  displayName: string;
  defaultDomain: string;
};

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

export class AzureProjectQueryService {
  constructor(
    private readonly logEvent: AzureArmPagedFetchLogEvent,
    private readonly armPagedFetchGateway: AzureArmPagedFetchGateway,
  ) {}

  async loadAzureProjectsWithFallback(
    accessToken: string,
  ): Promise<AzureProject[]> {
    return loadAzureProjectsWithFallback(
      accessToken,
      this.logEvent,
      this.armPagedFetchGateway,
    );
  }

  async loadAzureTenantsWithFallback(
    accessToken: string,
    activeTenantId: string,
  ): Promise<AzureTenant[]> {
    return loadAzureTenantsWithFallback(
      accessToken,
      activeTenantId,
      this.logEvent,
      this.armPagedFetchGateway,
    );
  }

  async listProjectDeployments(
    accessToken: string,
    projectRef: AzureProjectRef,
  ): Promise<AzureDeployment[]> {
    return listProjectDeployments(
      accessToken,
      projectRef,
      this.logEvent,
      this.armPagedFetchGateway,
    );
  }
}

export function createAzureProjectQueryService(
  options: {
    logEvent: AzureArmPagedFetchLogEvent;
    armPagedFetchGateway: AzureArmPagedFetchGateway;
  },
): AzureProjectQueryService {
  return new AzureProjectQueryService(
    options.logEvent,
    options.armPagedFetchGateway,
  );
}

async function loadAzureProjectsWithFallback(
  accessToken: string,
  logEvent: AzureArmPagedFetchLogEvent,
  armPagedFetchGateway: AzureArmPagedFetchGateway,
): Promise<AzureProject[]> {
  try {
    return await listAzureProjects(accessToken, logEvent, armPagedFetchGateway);
  } catch (error) {
    await logEvent({
      route: AZURE_PROJECT_QUERY_LOG_LOCATION,
      eventName: "load_azure_projects_partial_failed",
      action: "list_projects",
      level: "warning",
      error,
      context: {
        fallbackProjects: true,
      },
    });
    return [];
  }
}

async function loadAzureTenantsWithFallback(
  accessToken: string,
  activeTenantId: string,
  logEvent: AzureArmPagedFetchLogEvent,
  armPagedFetchGateway: AzureArmPagedFetchGateway,
): Promise<AzureTenant[]> {
  try {
    return await listAzureTenants(
      accessToken,
      activeTenantId,
      logEvent,
      armPagedFetchGateway,
    );
  } catch (error) {
    await logEvent({
      route: AZURE_PROJECT_QUERY_LOG_LOCATION,
      eventName: "load_azure_tenants_failed",
      action: "list_tenants",
      level: "warning",
      error,
      context: {
        tenantId: activeTenantId || null,
      },
    });

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

export async function listAzureProjects(
  accessToken: string,
  logEvent: AzureArmPagedFetchLogEvent,
  armPagedFetchGateway: AzureArmPagedFetchGateway,
): Promise<AzureProject[]> {
  const subscriptions = await armPagedFetchGateway.fetchPaged<ArmSubscription>({
    url: `https://management.azure.com/subscriptions?api-version=${AZURE_SUBSCRIPTIONS_API_VERSION}`,
    accessToken,
    maxItems: AZURE_MAX_SUBSCRIPTIONS,
    logEvent,
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

  const discovered = (
    await mapWithConcurrency(
      enabledSubscriptionIds,
      AZURE_SUBSCRIPTION_ACCOUNT_FETCH_CONCURRENCY,
      async (
        subscriptionId,
      ): Promise<Array<AzureProject & { resourceGroup: string }>> => {
        let accounts: ArmCognitiveAccount[];
        try {
          accounts = await armPagedFetchGateway.fetchPaged<ArmCognitiveAccount>({
            url: `https://management.azure.com/subscriptions/${encodeURIComponent(subscriptionId)}/providers/Microsoft.CognitiveServices/accounts?api-version=${AZURE_COGNITIVE_API_VERSION}`,
            accessToken,
            maxItems: AZURE_MAX_ACCOUNTS_PER_SUBSCRIPTION,
            logEvent,
          });
        } catch (error) {
          await logEvent({
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

        const projects: Array<AzureProject & { resourceGroup: string }> = [];
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
            id: createProjectId({
              subscriptionId,
              resourceGroup,
              accountName,
            }),
            projectName: accountName,
            baseUrl,
            apiVersion: AZURE_OPENAI_DEFAULT_API_VERSION,
            resourceGroup,
          });
        }

        return projects;
      },
    )
  ).flat();

  const dedupeById = new Set<string>();
  const dedupedDiscovered: Array<AzureProject & { resourceGroup: string }> = [];
  for (const project of discovered) {
    if (dedupeById.has(project.id)) {
      continue;
    }

    dedupeById.add(project.id);
    dedupedDiscovered.push(project);
  }

  const nameCounts = new Map<string, number>();
  for (const project of dedupedDiscovered) {
    const key = project.projectName.toLowerCase();
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
  }

  const projects = dedupedDiscovered
    .map(({ resourceGroup, ...project }) => {
      const nameKey = project.projectName.toLowerCase();
      const duplicateCount = nameCounts.get(nameKey) ?? 0;
      return duplicateCount > 1
        ? {
            ...project,
            projectName: `${project.projectName} (${resourceGroup})`,
          }
        : project;
    })
    .sort((left, right) => left.projectName.localeCompare(right.projectName));

  return projects;
}

export async function listAzureTenants(
  accessToken: string,
  activeTenantId: string,
  logEvent: AzureArmPagedFetchLogEvent,
  armPagedFetchGateway: AzureArmPagedFetchGateway,
  abortSignal?: AbortSignal,
): Promise<AzureTenant[]> {
  const discovered = await armPagedFetchGateway.fetchPaged<ArmTenant>({
    url: `https://management.azure.com/tenants?api-version=${AZURE_TENANTS_API_VERSION}`,
    accessToken,
    maxItems: AZURE_MAX_TENANTS,
    logEvent,
    abortSignal,
  });

  const tenantsById = new Map<string, AzureTenant>();
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

  const normalizedActiveTenantId = activeTenantId.trim();
  const normalizedActiveTenantKey = normalizedActiveTenantId.toLowerCase();
  if (normalizedActiveTenantId && !tenantsById.has(normalizedActiveTenantKey)) {
    tenantsById.set(normalizedActiveTenantKey, {
      tenantId: normalizedActiveTenantId,
      displayName: normalizedActiveTenantId,
      defaultDomain: "",
    });
  }

  return Array.from(tenantsById.values()).sort((left, right) => {
    if (
      normalizedActiveTenantKey &&
      left.tenantId.toLowerCase() === normalizedActiveTenantKey
    ) {
      return -1;
    }
    if (
      normalizedActiveTenantKey &&
      right.tenantId.toLowerCase() === normalizedActiveTenantKey
    ) {
      return 1;
    }
    return left.displayName.localeCompare(right.displayName);
  });
}

export async function listProjectDeployments(
  accessToken: string,
  projectRef: AzureProjectRef,
  logEvent: AzureArmPagedFetchLogEvent,
  armPagedFetchGateway: AzureArmPagedFetchGateway,
): Promise<AzureDeployment[]> {
  const { subscriptionId, resourceGroup, accountName } = projectRef;
  const deployments = await armPagedFetchGateway.fetchPaged<ArmCognitiveDeployment>({
    url: `https://management.azure.com/subscriptions/${encodeURIComponent(subscriptionId)}/resourceGroups/${encodeURIComponent(resourceGroup)}/providers/Microsoft.CognitiveServices/accounts/${encodeURIComponent(accountName)}/deployments?api-version=${AZURE_COGNITIVE_API_VERSION}`,
    accessToken,
    maxItems: AZURE_MAX_DEPLOYMENTS_PER_ACCOUNT,
    logEvent,
  });

  const accountModels = await listAccountModels(
    accessToken,
    projectRef,
    logEvent,
    armPagedFetchGateway,
  );
  const modelCapabilities = buildModelCapabilitiesMap(accountModels);

  const deploymentsByName = new Map<string, AzureDeployment>();

  for (const deployment of deployments) {
    const name =
      typeof deployment.name === "string" ? deployment.name.trim() : "";
    if (!name) {
      continue;
    }

    if (!isDeploymentSucceeded(deployment)) {
      continue;
    }

    if (!isAgentsSdkCompatibleDeployment(deployment, modelCapabilities)) {
      continue;
    }

    const model = deployment.properties?.model;
    const modelName =
      typeof model?.name === "string" ? model.name.trim().toLowerCase() : "";
    const modelVersion =
      typeof model?.version === "string"
        ? model.version.trim().toLowerCase()
        : "";
    const capabilities =
      modelCapabilities.get(createModelKey(modelName, modelVersion)) ??
      modelCapabilities.get(createModelKey(modelName, ""));
    const reasoningEffortOptions = resolveDeploymentReasoningEffortOptions(
      modelName,
      capabilities,
    );

    const key = name.toLowerCase();
    const existing = deploymentsByName.get(key);
    if (existing) {
      existing.reasoningEffortOptions = mergeReasoningEffortOptions(
        existing.reasoningEffortOptions,
        reasoningEffortOptions,
      );
      continue;
    }

    deploymentsByName.set(key, {
      name,
      reasoningEffortOptions,
    });
  }

  return [...deploymentsByName.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

async function listAccountModels(
  accessToken: string,
  projectRef: AzureProjectRef,
  logEvent: AzureArmPagedFetchLogEvent,
  armPagedFetchGateway: AzureArmPagedFetchGateway,
): Promise<ArmAccountModel[]> {
  const { subscriptionId, resourceGroup, accountName } = projectRef;
  try {
    return await armPagedFetchGateway.fetchPaged<ArmAccountModel>({
      url: `https://management.azure.com/subscriptions/${encodeURIComponent(subscriptionId)}/resourceGroups/${encodeURIComponent(resourceGroup)}/providers/Microsoft.CognitiveServices/accounts/${encodeURIComponent(accountName)}/models?api-version=${AZURE_COGNITIVE_API_VERSION}`,
      accessToken,
      maxItems: AZURE_MAX_MODELS_PER_ACCOUNT,
      logEvent,
    });
  } catch (error) {
    await logEvent({
      route: AZURE_PROJECT_QUERY_LOG_LOCATION,
      eventName: "list_account_models_failed",
      action: "list_account_models",
      level: "warning",
      error,
      context: {
        subscriptionId,
        resourceGroup,
        accountName,
      },
    });
    return [];
  }
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error.";
}

export function isLikelyAzureAuthError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return [
    "defaultazurecredential",
    "interactivebrowsercredential",
    "authenticationrequirederror",
    "automatic authentication has been disabled",
    "chainedtokencredential",
    "credentialunavailableerror",
    "managedidentitycredential",
    "azure credential failed",
    "authentication",
    "authorization",
    "unauthorized",
    "forbidden",
    "access token",
    "aadsts",
  ].some((pattern) => message.includes(pattern));
}
