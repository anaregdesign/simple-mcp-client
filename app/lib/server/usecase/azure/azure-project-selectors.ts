import {
  buildModelCapabilitiesMap,
  createModelKey,
  isAgentsSdkCompatibleDeployment,
  isDeploymentSucceeded,
  mergeReasoningEffortOptions,
  resolveDeploymentReasoningEffortOptions,
  type AzureOpenAIModelCapabilitySource,
} from "~/lib/domain/value-objects/azure-openai-model-capabilities";
import type {
  AzureOpenAIAccountRecord,
  AzureOpenAIDeploymentRecord,
  AzureTenantRecord,
} from "~/lib/domain/repositories/azure-project-query-gateway";
import {
  createProjectId,
} from "~/lib/contracts/api/azure-project-id";
import { AZURE_OPENAI_DEFAULT_API_VERSION } from "~/lib/constants/azure";
import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";

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

export function selectAzureProjectList(
  discovered: AzureOpenAIAccountRecord[],
): AzureProject[] {
  const dedupeById = new Set<string>();
  const dedupedDiscovered: Array<
    AzureProject & {
      resourceGroup: string;
    }
  > = [];

  for (const account of discovered) {
    const id = createProjectId({
      subscriptionId: account.subscriptionId,
      resourceGroup: account.resourceGroup,
      accountName: account.accountName,
    });
    if (dedupeById.has(id)) {
      continue;
    }

    dedupeById.add(id);
    dedupedDiscovered.push({
      id,
      projectName: account.accountName,
      baseUrl: account.baseUrl,
      apiVersion: AZURE_OPENAI_DEFAULT_API_VERSION,
      resourceGroup: account.resourceGroup,
    });
  }

  const nameCounts = new Map<string, number>();
  for (const project of dedupedDiscovered) {
    const key = project.projectName.toLowerCase();
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
  }

  return dedupedDiscovered
    .map(({ resourceGroup, ...project }) => {
      const duplicateCount = nameCounts.get(project.projectName.toLowerCase()) ?? 0;
      return duplicateCount > 1
        ? {
            ...project,
            projectName: `${project.projectName} (${resourceGroup})`,
          }
        : project;
    })
    .sort((left, right) => left.projectName.localeCompare(right.projectName));
}

export function selectAzureDeploymentList(
  deployments: AzureOpenAIDeploymentRecord[],
  accountModels: AzureOpenAIModelCapabilitySource[],
): AzureDeployment[] {
  const modelCapabilities = buildModelCapabilitiesMap(accountModels);
  const deploymentsByName = new Map<string, AzureDeployment>();

  for (const deployment of deployments) {
    if (!isDeploymentSucceeded(deployment.capability)) {
      continue;
    }

    if (
      !isAgentsSdkCompatibleDeployment(deployment.capability, modelCapabilities)
    ) {
      continue;
    }

    const model = deployment.capability.model;
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

    const key = deployment.name.toLowerCase();
    const existing = deploymentsByName.get(key);
    if (existing) {
      existing.reasoningEffortOptions = mergeReasoningEffortOptions(
        existing.reasoningEffortOptions,
        reasoningEffortOptions,
      );
      continue;
    }

    deploymentsByName.set(key, {
      name: deployment.name,
      reasoningEffortOptions,
    });
  }

  return [...deploymentsByName.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

export function prioritizeActiveTenant(
  tenants: AzureTenantRecord[],
  activeTenantId: string,
): AzureTenant[] {
  const normalizedActiveTenantId = activeTenantId.trim();
  const tenantsById = new Map<string, AzureTenant>();
  for (const tenant of tenants) {
    tenantsById.set(tenant.tenantId.toLowerCase(), tenant);
  }

  if (
    normalizedActiveTenantId &&
    !tenantsById.has(normalizedActiveTenantId.toLowerCase())
  ) {
    tenantsById.set(normalizedActiveTenantId.toLowerCase(), {
      tenantId: normalizedActiveTenantId,
      displayName: normalizedActiveTenantId,
      defaultDomain: "",
    });
  }

  return [...tenantsById.values()].sort((left, right) => {
    if (
      normalizedActiveTenantId &&
      left.tenantId.toLowerCase() === normalizedActiveTenantId.toLowerCase()
    ) {
      return -1;
    }
    if (
      normalizedActiveTenantId &&
      right.tenantId.toLowerCase() === normalizedActiveTenantId.toLowerCase()
    ) {
      return 1;
    }
    return left.displayName.localeCompare(right.displayName);
  });
}
