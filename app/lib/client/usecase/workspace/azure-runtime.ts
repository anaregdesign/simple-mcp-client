/**
 * Client controller Azure runtime helpers.
 */
import type { AzureTenantOption } from "~/lib/client/azure/parsers";

export type AzureAuthStateUpdateSource =
  | "background_success"
  | "interactive_login"
  | "projects_response";

export type AzureProjectsLoadResult = {
  authRequired: boolean;
  tenantSwitchPending: boolean;
};

export function resolveAzureTenantOptions(
  tenants: AzureTenantOption[],
  activeTenantIdRaw: string,
): AzureTenantOption[] {
  const activeTenantId = activeTenantIdRaw.trim();
  const activeTenantKey = activeTenantId.toLowerCase();
  const tenantById = new Map<string, AzureTenantOption>();

  for (const tenant of tenants) {
    const tenantId = tenant.tenantId.trim();
    const tenantKey = tenantId.toLowerCase();
    if (!tenantId || tenantById.has(tenantKey)) {
      continue;
    }

    tenantById.set(tenantKey, {
      tenantId,
      displayName: tenant.displayName.trim() || tenant.defaultDomain.trim() || tenantId,
      defaultDomain: tenant.defaultDomain.trim(),
    });
  }

  if (activeTenantId && !tenantById.has(activeTenantKey)) {
    tenantById.set(activeTenantKey, {
      tenantId: activeTenantId,
      displayName: activeTenantId,
      defaultDomain: "",
    });
  }

  return Array.from(tenantById.values()).sort((left, right) => {
    if (activeTenantKey && left.tenantId.toLowerCase() === activeTenantKey) {
      return -1;
    }
    if (activeTenantKey && right.tenantId.toLowerCase() === activeTenantKey) {
      return 1;
    }
    return left.displayName.localeCompare(right.displayName);
  });
}

export function resolveInitialAzureProjectId(options: {
  knownProjectIds: Set<string>;
  currentProjectId: string;
  preferredProjectId: string;
  fallbackProjectId?: string;
  defaultProjectId?: string;
}): string {
  const normalizedCurrentProjectId = options.currentProjectId.trim();
  if (options.knownProjectIds.has(normalizedCurrentProjectId)) {
    return normalizedCurrentProjectId;
  }

  const normalizedPreferredProjectId = options.preferredProjectId.trim();
  if (options.knownProjectIds.has(normalizedPreferredProjectId)) {
    return normalizedPreferredProjectId;
  }

  const normalizedFallbackProjectId = options.fallbackProjectId?.trim() ?? "";
  if (options.knownProjectIds.has(normalizedFallbackProjectId)) {
    return normalizedFallbackProjectId;
  }

  return options.defaultProjectId?.trim() ?? "";
}

export function shouldUseCachedAzureProjectCatalog(options: {
  forceReload: boolean;
  isAzureAuthRequired: boolean;
}): boolean {
  if (options.forceReload) {
    return false;
  }

  // When auth is required we must revalidate against the server to avoid stale cache-based unlocks.
  return !options.isAzureAuthRequired;
}

export function resolveAzureAuthRequiredState(options: {
  currentAuthRequired: boolean;
  nextAuthRequired: boolean;
  source: AzureAuthStateUpdateSource;
}): boolean {
  if (
    options.source === "background_success" &&
    options.currentAuthRequired &&
    options.nextAuthRequired === false
  ) {
    return true;
  }

  return options.nextAuthRequired;
}

export function buildAzureProjectsLoadResult(options: {
  authRequired: boolean;
  preferredTenantId: string;
  resolvedTenantId: string;
}): AzureProjectsLoadResult {
  if (options.authRequired) {
    return {
      authRequired: true,
      tenantSwitchPending: false,
    };
  }

  const preferredTenantId = options.preferredTenantId.trim().toLowerCase();
  const resolvedTenantId = options.resolvedTenantId.trim().toLowerCase();
  if (preferredTenantId && resolvedTenantId && preferredTenantId !== resolvedTenantId) {
    return {
      authRequired: false,
      tenantSwitchPending: true,
    };
  }

  return {
    authRequired: false,
    tenantSwitchPending: false,
  };
}

export function isAzureProjectsLoadReady(result: AzureProjectsLoadResult): boolean {
  return !result.authRequired && !result.tenantSwitchPending;
}
