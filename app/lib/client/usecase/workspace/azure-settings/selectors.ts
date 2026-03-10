import { DEFAULT_REASONING_EFFORT } from "~/lib/domain/value-objects/reasoning-effort";
import type {
  AzureDeploymentOption,
  AzureProjectOption,
} from "./parsers";
import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";
import {
  readAzureDeploymentCacheKey,
  readAzureTenantCacheKey,
} from "./catalog-state";
import type { AzureSettingsState } from "./types";

export function selectActiveAzureConnection(
  connections: AzureProjectOption[],
  selectedConnectionId: string,
): AzureProjectOption | null {
  return (
    connections.find((connection) => connection.id === selectedConnectionId) ??
    connections[0] ??
    null
  );
}

export function includesAzureDeploymentName(
  deployments: AzureDeploymentOption[],
  deploymentNameRaw: string,
): boolean {
  const deploymentName = deploymentNameRaw.trim();
  if (!deploymentName) {
    return false;
  }

  return deployments.some((deployment) => deployment.name === deploymentName);
}

export function resolveSupportedReasoningEffortOptions(
  options: readonly ReasoningEffort[],
): ReasoningEffort[] {
  const optionSet = new Set(options);
  return ["none", "minimal", "low", "medium", "high", "xhigh"].filter(
    (effort): effort is ReasoningEffort => optionSet.has(effort as ReasoningEffort),
  );
}

export function isWebSearchCompatibleReasoningEffort(
  value: ReasoningEffort,
): boolean {
  return value !== "minimal";
}

export function isReasoningEffortCompatibleWithDeployment(
  deploymentNameRaw: string,
  value: ReasoningEffort,
): boolean {
  const deploymentName = deploymentNameRaw.trim().toLowerCase();
  if (deploymentName.startsWith("gpt-5.4")) {
    return value !== "minimal";
  }

  return true;
}

export function filterReasoningEffortOptionsForDeploymentCompatibility(
  options: readonly ReasoningEffort[],
  deploymentNameRaw: string,
): ReasoningEffort[] {
  return options.filter((value) =>
    isReasoningEffortCompatibleWithDeployment(deploymentNameRaw, value),
  );
}

export function filterReasoningEffortOptionsForWebSearch(
  options: readonly ReasoningEffort[],
  webSearchEnabled: boolean,
): ReasoningEffort[] {
  if (!webSearchEnabled) {
    return [...options];
  }

  return options.filter(isWebSearchCompatibleReasoningEffort);
}

export function resolveEffectiveReasoningEffort(
  current: ReasoningEffort,
  options: readonly ReasoningEffort[],
  fallback: ReasoningEffort,
): ReasoningEffort {
  if (options.includes(current)) {
    return current;
  }

  if (options.includes(fallback)) {
    return fallback;
  }

  return options[0] ?? DEFAULT_REASONING_EFFORT;
}

export function selectPlaygroundReasoningEffortViewModel(options: {
  playgroundAzureDeployments: AzureDeploymentOption[];
  selectedPlaygroundAzureDeploymentName: string;
  reasoningEffort: ReasoningEffort;
  webSearchEnabled: boolean;
}) {
  const selectedPlaygroundAzureDeployment =
    options.playgroundAzureDeployments.find(
      (deployment) =>
        deployment.name === options.selectedPlaygroundAzureDeploymentName,
    );
  const selectedPlaygroundDeploymentReasoningEffortOptions =
    resolveSupportedReasoningEffortOptions(
      selectedPlaygroundAzureDeployment?.reasoningEffortOptions ?? [],
    );
  const selectedPlaygroundDeploymentCompatibleReasoningEffortOptions =
    filterReasoningEffortOptionsForDeploymentCompatibility(
      selectedPlaygroundDeploymentReasoningEffortOptions,
      options.selectedPlaygroundAzureDeploymentName,
    );
  const isPlaygroundReasoningEffortSupported =
    selectedPlaygroundDeploymentCompatibleReasoningEffortOptions.length > 0;
  const effectivePlaygroundReasoningEffortOptions: ReasoningEffort[] =
    isPlaygroundReasoningEffortSupported
      ? filterReasoningEffortOptionsForWebSearch(
          selectedPlaygroundDeploymentCompatibleReasoningEffortOptions,
          options.webSearchEnabled,
        )
      : ["none"];
  const isSelectedPlaygroundReasoningEffortOptionAvailable =
    !isPlaygroundReasoningEffortSupported ||
    effectivePlaygroundReasoningEffortOptions.includes(options.reasoningEffort);
  const isPlaygroundReasoningEffortWebSearchCompatible =
    !options.webSearchEnabled ||
    !isPlaygroundReasoningEffortSupported ||
    isWebSearchCompatibleReasoningEffort(options.reasoningEffort);

  return {
    effectivePlaygroundReasoningEffortOptions,
    isPlaygroundReasoningEffortSupported,
    selectedPlaygroundDeploymentCompatibleReasoningEffortOptions,
    isSelectedPlaygroundReasoningEffortOptionAvailable,
    isPlaygroundReasoningEffortWebSearchCompatible,
    isPlaygroundDeploymentAvailable(deploymentName: string): boolean {
      return includesAzureDeploymentName(
        options.playgroundAzureDeployments,
        deploymentName,
      );
    },
    isPlaygroundReasoningEffortOptionAvailable(
      nextReasoningEffort: ReasoningEffort,
    ): boolean {
      return effectivePlaygroundReasoningEffortOptions.includes(
        nextReasoningEffort,
      );
    },
  };
}

export function selectCachedAzureProjectCatalog(
  state: AzureSettingsState,
  tenantIdRaw: string,
) {
  const tenantKey = readAzureTenantCacheKey(tenantIdRaw);
  if (!tenantKey) {
    return null;
  }

  return state.azureProjectCatalogCacheByTenantId[tenantKey] ?? null;
}

export function selectCachedAzureDeployments(
  state: AzureSettingsState,
  tenantIdRaw: string,
  projectIdRaw: string,
): AzureDeploymentOption[] | null {
  const deploymentKey = readAzureDeploymentCacheKey(tenantIdRaw, projectIdRaw);
  if (!deploymentKey) {
    return null;
  }

  const cached =
    state.azureDeploymentCatalogCacheByTenantProjectKey[deploymentKey];
  return cached ? cached.map((deployment) => ({ ...deployment, reasoningEffortOptions: [...deployment.reasoningEffortOptions] })) : null;
}
