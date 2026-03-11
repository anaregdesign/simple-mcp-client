import {
  clearDeploymentCatalogCacheByTenant,
  readNextDeploymentCatalogCache,
  readNextProjectCatalogCache,
  readAzureTenantCacheKey,
} from "./catalog-state";
import type {
  AzureProjectCatalogCacheEntry,
  AzureSettingsState,
  AzureSettingsStatePatch,
} from "./types";
import { createInitialAzureSettingsState } from "./state";

export type AzureSettingsAction =
  | {
      type: "state/patch";
      patch: AzureSettingsStatePatch;
    }
  | {
      type: "project_cache/upsert";
      entry: AzureProjectCatalogCacheEntry;
    }
  | {
      type: "deployment_cache/upsert";
      tenantId: string;
      projectId: string;
      deployments: AzureSettingsState["playgroundAzureDeployments"];
    }
  | {
      type: "cache/clear_tenant";
      tenantId: string;
    }
  | {
      type: "cache/clear_all";
    };

export function azureSettingsReducer(
  state: AzureSettingsState,
  action: AzureSettingsAction,
): AzureSettingsState {
  switch (action.type) {
    case "state/patch": {
      const patchEntries = Object.entries(action.patch) as Array<
        [keyof AzureSettingsState, AzureSettingsState[keyof AzureSettingsState]]
      >;
      const hasStateChange = patchEntries.some(([key, value]) => !Object.is(state[key], value));
      if (!hasStateChange) {
        return state;
      }

      return {
        ...state,
        ...action.patch,
      };
    }
    case "project_cache/upsert":
      return {
        ...state,
        azureProjectCatalogCacheByTenantId: readNextProjectCatalogCache(
          state.azureProjectCatalogCacheByTenantId,
          action.entry,
        ),
      };
    case "deployment_cache/upsert":
      return {
        ...state,
        azureDeploymentCatalogCacheByTenantProjectKey:
          readNextDeploymentCatalogCache(
            state.azureDeploymentCatalogCacheByTenantProjectKey,
            action.tenantId,
            action.projectId,
            action.deployments,
          ),
      };
    case "cache/clear_tenant": {
      const tenantKey = readAzureTenantCacheKey(action.tenantId);
      const nextProjectCatalogCache = { ...state.azureProjectCatalogCacheByTenantId };
      if (tenantKey) {
        delete nextProjectCatalogCache[tenantKey];
      }

      return {
        ...state,
        azureProjectCatalogCacheByTenantId: nextProjectCatalogCache,
        azureDeploymentCatalogCacheByTenantProjectKey:
          clearDeploymentCatalogCacheByTenant(
            state.azureDeploymentCatalogCacheByTenantProjectKey,
            action.tenantId,
          ),
      };
    }
    case "cache/clear_all":
      return {
        ...state,
        azureProjectCatalogCacheByTenantId: {},
        azureDeploymentCatalogCacheByTenantProjectKey: {},
      };
    default: {
      const exhaustiveAction: never = action;
      return exhaustiveAction;
    }
  }
}

export function createInitialAzureSettingsReducerState(): AzureSettingsState {
  return createInitialAzureSettingsState();
}
