import type {
  AzureDeploymentOption,
} from "~/lib/client/usecase/workspace/azure-parsers";
import type {
  AzureDeploymentCatalogCacheByTenantProjectKey,
  AzureProjectCatalogCacheByTenantId,
  AzureProjectCatalogCacheEntry,
} from "./types";

export function readAzureTenantCacheKey(tenantIdRaw: string): string {
  return tenantIdRaw.trim().toLowerCase();
}

export function readAzureDeploymentCacheKey(
  tenantIdRaw: string,
  projectIdRaw: string,
): string {
  const tenantKey = readAzureTenantCacheKey(tenantIdRaw);
  const projectId = projectIdRaw.trim();
  if (!tenantKey || !projectId) {
    return "";
  }

  return `${tenantKey}::${projectId}`;
}

export function cloneAzureDeploymentOption(
  deployment: AzureDeploymentOption,
): AzureDeploymentOption {
  return {
    ...deployment,
    reasoningEffortOptions: [...deployment.reasoningEffortOptions],
  };
}

export function readNextProjectCatalogCache(
  current: AzureProjectCatalogCacheByTenantId,
  entry: AzureProjectCatalogCacheEntry,
): AzureProjectCatalogCacheByTenantId {
  const tenantKey = readAzureTenantCacheKey(entry.tenantId);
  if (!tenantKey) {
    return current;
  }

  return {
    ...current,
    [tenantKey]: {
      tenantId: entry.tenantId,
      principalId: entry.principalId,
      principal: entry.principal ? { ...entry.principal } : null,
      tenants: entry.tenants.map((tenant) => ({ ...tenant })),
      projects: entry.projects.map((project) => ({ ...project })),
    },
  };
}

export function readNextDeploymentCatalogCache(
  current: AzureDeploymentCatalogCacheByTenantProjectKey,
  tenantIdRaw: string,
  projectIdRaw: string,
  deployments: AzureDeploymentOption[],
): AzureDeploymentCatalogCacheByTenantProjectKey {
  const deploymentKey = readAzureDeploymentCacheKey(tenantIdRaw, projectIdRaw);
  if (!deploymentKey) {
    return current;
  }

  return {
    ...current,
    [deploymentKey]: deployments.map(cloneAzureDeploymentOption),
  };
}

export function clearDeploymentCatalogCacheByTenant(
  current: AzureDeploymentCatalogCacheByTenantProjectKey,
  tenantIdRaw: string,
): AzureDeploymentCatalogCacheByTenantProjectKey {
  const tenantKey = readAzureTenantCacheKey(tenantIdRaw);
  if (!tenantKey) {
    return current;
  }

  const prefix = `${tenantKey}::`;
  let changed = false;
  const next: AzureDeploymentCatalogCacheByTenantProjectKey = {};
  for (const [key, deployments] of Object.entries(current)) {
    if (key.startsWith(prefix)) {
      changed = true;
      continue;
    }

    next[key] = deployments.map(cloneAzureDeploymentOption);
  }

  return changed ? next : current;
}
