import {
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  applyAzureAuthRequiredState,
} from "./catalog-identity";
import type {
  AzureSelectionPreference,
} from "./parsers";
import {
  azureSettingsReducer,
  createInitialAzureSettingsReducerState,
} from "./reducer";
import type {
  AzureSettingsHandlerDependencies,
  AzureSettingsState,
  UseAzureSettingsOptions,
} from "./types";

function createHarness(
  overrides: Partial<AzureSettingsState> = {},
) {
  let state: AzureSettingsState = {
    ...createInitialAzureSettingsReducerState(),
    ...overrides,
  };
  let preferredAzureSelection: AzureSelectionPreference | null = {
    tenantId: "tenant-a",
    principalId: "principal-a",
    theme: "dark",
    playground: {
      projectId: "project-a",
      deploymentName: "deploy-a",
    },
    utility: {
      projectId: "project-b",
      deploymentName: "deploy-b",
      reasoningEffort: "minimal",
    },
  };
  let azureConnectionsRequestSeq = 0;
  let playgroundAzureDeploymentRequestSeq = 0;
  let utilityAzureDeploymentRequestSeq = 0;
  const runtimeState = {
    activeAzureTenantId: "tenant-a",
    activeAzurePrincipalId: "principal-a",
    activeWorkspaceUserKey: "tenant-a::principal-a",
    selectedPlaygroundAzureConnectionId: "project-a",
    selectedPlaygroundAzureDeploymentName: "deploy-a",
    selectedUtilityAzureConnectionId: "project-b",
    selectedUtilityAzureDeploymentName: "deploy-b",
  };
  const options: UseAzureSettingsOptions = {
    isSending: false,
    reasoningEffort: "medium",
    webSearchEnabled: false,
    readIsThreadsReady: vi.fn(() => true),
    readIsLoadingThreads: vi.fn(() => false),
    setSystemNotice: vi.fn(),
    readActiveAzureTenantId: () => runtimeState.activeAzureTenantId,
    writeActiveAzureTenantId: (value: string) => {
      runtimeState.activeAzureTenantId = value;
    },
    readActiveAzurePrincipalId: () => runtimeState.activeAzurePrincipalId,
    writeActiveAzurePrincipalId: (value: string) => {
      runtimeState.activeAzurePrincipalId = value;
    },
    readActiveWorkspaceUserKey: () => runtimeState.activeWorkspaceUserKey,
    writeActiveWorkspaceUserKey: (value: string) => {
      runtimeState.activeWorkspaceUserKey = value;
    },
    readSelectedPlaygroundAzureConnectionId: () =>
      runtimeState.selectedPlaygroundAzureConnectionId,
    writeSelectedPlaygroundAzureConnectionId: (value: string) => {
      runtimeState.selectedPlaygroundAzureConnectionId = value;
    },
    writeSelectedPlaygroundAzureDeploymentName: (value: string) => {
      runtimeState.selectedPlaygroundAzureDeploymentName = value;
    },
    readSelectedUtilityAzureConnectionId: () =>
      runtimeState.selectedUtilityAzureConnectionId,
    writeSelectedUtilityAzureConnectionId: (value: string) => {
      runtimeState.selectedUtilityAzureConnectionId = value;
    },
    writeSelectedUtilityAzureDeploymentName: (value: string) => {
      runtimeState.selectedUtilityAzureDeploymentName = value;
    },
    clearWorkspaceMcpServerProfilesState: vi.fn(),
    loadWorkspaceMcpServerProfiles: vi.fn(async () => {}),
    clearThreadsState: vi.fn(),
    showThreadReloadPlaceholder: vi.fn(),
    loadThreads: vi.fn(async () => {}),
    logClientError: vi.fn(),
    logClientWarning: vi.fn(),
  };
  const dispatch = vi.fn((action) => {
    state = azureSettingsReducer(state, action);
  });
  const patchState = vi.fn((patch: Partial<AzureSettingsState>) => {
    state = {
      ...state,
      ...patch,
    };
  });
  const dependencies: AzureSettingsHandlerDependencies = {
    options,
    dispatch,
    patchState,
    readState: () => state,
    readPreferredAzureSelection: () => preferredAzureSelection,
    writePreferredAzureSelection: (selection) => {
      preferredAzureSelection = selection;
    },
    nextAzureConnectionsRequestSeq: () => {
      azureConnectionsRequestSeq += 1;
      return azureConnectionsRequestSeq;
    },
    readAzureConnectionsRequestSeq: () => azureConnectionsRequestSeq,
    nextAzureDeploymentRequestSeq: (target) => {
      if (target === "playground") {
        playgroundAzureDeploymentRequestSeq += 1;
        return playgroundAzureDeploymentRequestSeq;
      }

      utilityAzureDeploymentRequestSeq += 1;
      return utilityAzureDeploymentRequestSeq;
    },
    readAzureDeploymentRequestSeq: (target) =>
      target === "playground"
        ? playgroundAzureDeploymentRequestSeq
        : utilityAzureDeploymentRequestSeq,
    clearWorkspaceMcpServerProfileLoginRetryTimeout: vi.fn(),
    scheduleWorkspaceMcpServerProfileLoginRetryTimeout: vi.fn(),
  };

  dispatch({
    type: "project_cache/upsert",
    entry: {
      tenantId: "tenant-a",
      principalId: "principal-a",
      principal: {
        tenantId: "tenant-a",
        principalId: "principal-a",
        displayName: "Azure User",
        principalName: "user@contoso.com",
        principalType: "user",
      },
      tenants: [
        {
          tenantId: "tenant-a",
          displayName: "Tenant A",
          defaultDomain: "contoso.com",
        },
      ],
      projects: [
        {
          id: "project-a",
          projectName: "Project A",
          baseUrl: "https://project-a.example.com",
          apiVersion: "2025-01-01",
        },
      ],
    },
  });
  dispatch({
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

  return {
    dependencies,
    options,
    runtimeState,
    readState: () => state,
    readPreferredAzureSelection: () => preferredAzureSelection,
  };
}

describe("applyAzureAuthRequiredState", () => {
  it("clears user-scoped Azure and workspace state after auth loss", () => {
    const harness = createHarness({
      azureConnections: [
        {
          id: "project-a",
          projectName: "Project A",
          baseUrl: "https://project-a.example.com",
          apiVersion: "2025-01-01",
        },
      ],
      azureTenants: [
        {
          tenantId: "tenant-a",
          displayName: "Tenant A",
          defaultDomain: "contoso.com",
        },
      ],
      activeAzurePrincipal: {
        tenantId: "tenant-a",
        principalId: "principal-a",
        displayName: "Azure User",
        principalName: "user@contoso.com",
        principalType: "user",
      },
      playgroundAzureDeployments: [
        {
          name: "deploy-a",
          reasoningEffortOptions: ["none", "medium"],
        },
      ],
      utilityAzureDeployments: [
        {
          name: "deploy-b",
          reasoningEffortOptions: ["minimal", "high"],
        },
      ],
      selectedPlaygroundAzureConnectionId: "project-a",
      selectedPlaygroundAzureDeploymentName: "deploy-a",
      selectedUtilityAzureConnectionId: "project-b",
      selectedUtilityAzureDeploymentName: "deploy-b",
      azureConnectionError: "stale error",
      playgroundAzureDeploymentError: "stale deployment error",
      utilityAzureDeploymentError: "stale utility error",
      utilityReasoningEffort: "minimal",
    });

    applyAzureAuthRequiredState(harness.dependencies);

    expect(harness.runtimeState.activeAzureTenantId).toBe("");
    expect(harness.runtimeState.activeAzurePrincipalId).toBe("");
    expect(harness.runtimeState.activeWorkspaceUserKey).toBe("");
    expect(harness.readPreferredAzureSelection()).toBeNull();
    expect(
      harness.dependencies.clearWorkspaceMcpServerProfileLoginRetryTimeout,
    ).toHaveBeenCalledTimes(1);
    expect(harness.options.clearWorkspaceMcpServerProfilesState).toHaveBeenCalledTimes(
      1,
    );
    expect(harness.options.clearThreadsState).toHaveBeenCalledWith(
      "Azure login is required. Open Settings and sign in to load threads.",
    );
    expect(harness.readState()).toMatchObject({
      isAzureAuthRequired: true,
      azureConnections: [],
      azureTenants: [],
      activeAzurePrincipal: null,
      playgroundAzureDeployments: [],
      utilityAzureDeployments: [],
      selectedPlaygroundAzureConnectionId: "",
      selectedPlaygroundAzureDeploymentName: "",
      selectedUtilityAzureConnectionId: "",
      selectedUtilityAzureDeploymentName: "",
      azureConnectionError: null,
      playgroundAzureDeploymentError: null,
      utilityAzureDeploymentError: null,
      utilityReasoningEffort: "high",
      azureProjectCatalogCacheByTenantId: {},
      azureDeploymentCatalogCacheByTenantProjectKey: {},
    });
  });
});
