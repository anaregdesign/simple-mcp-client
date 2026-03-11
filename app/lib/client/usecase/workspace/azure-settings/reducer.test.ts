import { describe, expect, it } from "vitest";
import {
  azureSettingsReducer,
  createInitialAzureSettingsReducerState,
} from "./reducer";

describe("azureSettingsReducer", () => {
  it("patches state fields", () => {
    const state = createInitialAzureSettingsReducerState();
    const next = azureSettingsReducer(state, {
      type: "state/patch",
      patch: {
        isAzureAuthRequired: true,
        selectedPlaygroundAzureConnectionId: "project-a",
      },
    });

    expect(next.isAzureAuthRequired).toBe(true);
    expect(next.selectedPlaygroundAzureConnectionId).toBe("project-a");
  });

  it("returns the same state for a no-op patch", () => {
    const state = createInitialAzureSettingsReducerState();
    const next = azureSettingsReducer(state, {
      type: "state/patch",
      patch: {
        theme: state.theme,
        isAzureAuthRequired: state.isAzureAuthRequired,
      },
    });

    expect(next).toBe(state);
  });

  it("clears tenant-scoped caches", () => {
    const state = azureSettingsReducer(
      createInitialAzureSettingsReducerState(),
      {
        type: "project_cache/upsert",
        entry: {
          tenantId: "tenant-a",
          principalId: "principal-a",
          principal: null,
          tenants: [],
          projects: [],
        },
      },
    );
    const withDeployments = azureSettingsReducer(state, {
      type: "deployment_cache/upsert",
      tenantId: "tenant-a",
      projectId: "project-a",
      deployments: [
        {
          name: "deploy-a",
          reasoningEffortOptions: ["none", "medium"],
        },
      ],
    });
    const next = azureSettingsReducer(withDeployments, {
      type: "cache/clear_tenant",
      tenantId: "tenant-a",
    });

    expect(next.azureProjectCatalogCacheByTenantId).toEqual({});
    expect(next.azureDeploymentCatalogCacheByTenantProjectKey).toEqual({});
  });
});
