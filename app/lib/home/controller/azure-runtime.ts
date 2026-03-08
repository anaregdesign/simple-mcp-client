/**
 * Home controller Azure runtime helpers.
 */
import type { AzureTenantOption } from "~/lib/home/azure/parsers";

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
