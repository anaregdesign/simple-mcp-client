import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("~/lib/client/infrastructure/api/azure-projects-api-client", () => ({
  azureProjectsApiClient: {
    loadProjects: vi.fn(),
    loadDeployments: vi.fn(),
  },
}));

vi.mock("~/lib/client/infrastructure/api/azure-selection-api-client", () => ({
  azureSelectionApiClient: {
    loadSelection: vi.fn(),
    saveSelection: vi.fn(),
  },
}));

vi.mock("~/lib/client/infrastructure/api/azure-session-api-client", () => ({
  azureSessionApiClient: {
    startSession: vi.fn(),
    endSession: vi.fn(),
  },
}));

import {
  azureProjectsApiClient,
} from "~/lib/client/infrastructure/api/azure-projects-api-client";
import {
  azureSelectionApiClient,
} from "~/lib/client/infrastructure/api/azure-selection-api-client";
import {
  azureSessionApiClient,
} from "~/lib/client/infrastructure/api/azure-session-api-client";
import {
  createAzureSettingsHandlers,
} from "./handlers";
import type {
  AzureSelectionPreference,
} from "./parsers";
import {
  azureSettingsReducer,
  createInitialAzureSettingsReducerState,
} from "./reducer";
import type {
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
  const preferredAzureSelectionRef: {
    current: AzureSelectionPreference | null;
  } = {
    current: null,
  };
  const options: UseAzureSettingsOptions = {
    isSending: false,
    readIsThreadsReady: vi.fn(() => false),
    readIsLoadingThreads: vi.fn(() => false),
    setSystemNotice: vi.fn(),
    activeAzureTenantIdRef: { current: "" },
    activeAzurePrincipalIdRef: { current: "" },
    activeWorkspaceUserKeyRef: { current: "" },
    selectedPlaygroundAzureConnectionIdRef: { current: "" },
    selectedPlaygroundAzureDeploymentNameRef: { current: "" },
    selectedUtilityAzureConnectionIdRef: { current: "" },
    selectedUtilityAzureDeploymentNameRef: { current: "" },
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
  const handlers = createAzureSettingsHandlers({
    options,
    dispatch,
    patchState,
    readState: () => state,
    preferredAzureSelectionRef,
    azureConnectionsRequestSeqRef: { current: 0 },
    playgroundAzureDeploymentRequestSeqRef: { current: 0 },
    utilityAzureDeploymentRequestSeqRef: { current: 0 },
    workspaceMcpServerProfileLoginRetryTimeoutRef: { current: null },
  });

  return {
    options,
    dispatch,
    patchState,
    handlers,
    preferredAzureSelectionRef,
    readState: () => state,
  };
}

describe("createAzureSettingsHandlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.stubGlobal("window", globalThis);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("reuses cached project catalog when auth is healthy", async () => {
    const harness = createHarness({
      isAzureAuthRequired: false,
    });
    harness.dispatch({
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
    vi.mocked(azureSelectionApiClient.loadSelection).mockResolvedValue({
      selection: {
        tenantId: "tenant-a",
        principalId: "principal-a",
        theme: "dark",
        playground: {
          projectId: "project-a",
          deploymentName: "deploy-a",
        },
        utility: null,
      },
    });

    const loadResult = await harness.handlers.loadAzureProjects({
      preferredTenantId: "tenant-a",
    });

    expect(loadResult).toEqual({
      authRequired: false,
      tenantSwitchPending: false,
    });
    expect(vi.mocked(azureProjectsApiClient.loadProjects)).not.toHaveBeenCalled();
    expect(harness.readState().azureConnections).toEqual([
      {
        id: "project-a",
        projectName: "Project A",
        baseUrl: "https://project-a.example.com",
        apiVersion: "2025-01-01",
      },
    ]);
    expect(harness.readState().theme).toBe("dark");
    expect(harness.options.activeWorkspaceUserKeyRef.current).toBe(
      "tenant-a::principal-a",
    );
    expect(harness.options.loadWorkspaceMcpServerProfiles).toHaveBeenCalledTimes(1);
    expect(harness.options.loadThreads).toHaveBeenCalledTimes(1);
  });

  it("schedules MCP profile retry after remote auth recovery", async () => {
    vi.useFakeTimers();
    const harness = createHarness({
      isAzureAuthRequired: true,
    });
    vi.mocked(azureProjectsApiClient.loadProjects).mockResolvedValue({
      authRequired: false,
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
    });
    vi.mocked(azureSelectionApiClient.loadSelection).mockResolvedValue({
      selection: {
        tenantId: "tenant-a",
        principalId: "principal-a",
        theme: "dark",
        playground: null,
        utility: null,
      },
    });

    await harness.handlers.loadAzureProjects({
      force: true,
    });

    await vi.advanceTimersByTimeAsync(1200);

    expect(harness.options.loadWorkspaceMcpServerProfiles).toHaveBeenCalledTimes(2);
  });

  it("returns tenant switch pending when the resolved tenant does not match the requested tenant", async () => {
    const harness = createHarness();
    vi.mocked(azureProjectsApiClient.loadProjects).mockResolvedValue({
      authRequired: false,
      tenantId: "tenant-b",
      principalId: "principal-b",
      principal: null,
      tenants: [],
      projects: [],
    });

    const loadResult = await harness.handlers.loadAzureProjects({
      force: true,
      preferredTenantId: "tenant-a",
    });

    expect(loadResult).toEqual({
      authRequired: false,
      tenantSwitchPending: true,
    });
    expect(harness.options.logClientWarning).toHaveBeenCalledWith(
      "azure_tenant_switch_verification_pending",
      "Resolved tenant does not match requested tenant yet.",
      expect.objectContaining({
        action: "load_azure_projects",
      }),
    );
  });

  it("cancels deployment loading by clearing the pending flag", () => {
    const harness = createHarness({
      isLoadingPlaygroundAzureDeployments: true,
      isLoadingUtilityAzureDeployments: true,
    });

    harness.handlers.cancelAzureDeploymentLoad("playground");
    harness.handlers.cancelAzureDeploymentLoad("utility");

    expect(harness.readState().isLoadingPlaygroundAzureDeployments).toBe(false);
    expect(harness.readState().isLoadingUtilityAzureDeployments).toBe(false);
  });

  it("persists the current theme for the active Azure identity", async () => {
    const harness = createHarness();
    harness.options.activeAzureTenantIdRef.current = "tenant-a";
    harness.options.activeAzurePrincipalIdRef.current = "principal-a";
    harness.preferredAzureSelectionRef.current = {
      tenantId: "tenant-a",
      principalId: "principal-a",
      theme: "light",
      playground: {
        projectId: "project-a",
        deploymentName: "deploy-a",
      },
      utility: null,
    };

    await harness.handlers.saveThemePreference("dark");

    expect(vi.mocked(azureSelectionApiClient.saveSelection)).toHaveBeenCalledWith({
      theme: "dark",
    });
    expect(harness.preferredAzureSelectionRef.current).toEqual({
      tenantId: "tenant-a",
      principalId: "principal-a",
      theme: "dark",
      playground: {
        projectId: "project-a",
        deploymentName: "deploy-a",
      },
      utility: null,
    });
  });

  it("persists identity-scoped utility selection changes", async () => {
    const harness = createHarness({
      theme: "dark",
    });

    await harness.handlers.saveAzureSelectionPreference({
      target: "utility",
      tenantId: "tenant-a",
      principalId: "principal-a",
      projectId: "project-a",
      deploymentName: "deploy-a",
      reasoningEffort: "high",
    });

    expect(vi.mocked(azureSelectionApiClient.saveSelection)).toHaveBeenCalledWith({
      target: "utility",
      projectId: "project-a",
      deploymentName: "deploy-a",
      reasoningEffort: "high",
      theme: null,
    });
    expect(harness.preferredAzureSelectionRef.current).toEqual({
      tenantId: "tenant-a",
      principalId: "principal-a",
      theme: "dark",
      playground: null,
      utility: {
        projectId: "project-a",
        deploymentName: "deploy-a",
        reasoningEffort: "high",
      },
    });
  });

  it("runs azure login through session operations and clears auth-required state", async () => {
    const harness = createHarness({
      isAzureAuthRequired: true,
    });
    vi.mocked(azureSessionApiClient.startSession).mockResolvedValue({
      message: "Azure login completed.",
    });
    vi.mocked(azureProjectsApiClient.loadProjects).mockResolvedValue({
      authRequired: false,
      tenantId: "tenant-a",
      principalId: "principal-a",
      principal: null,
      tenants: [],
      projects: [],
    });
    vi.mocked(azureSelectionApiClient.loadSelection).mockResolvedValue({
      selection: null,
    });

    await harness.handlers.handleAzureLogin();

    expect(vi.mocked(azureSessionApiClient.startSession)).toHaveBeenCalledWith("");
    expect(harness.readState().isStartingAzureLogin).toBe(false);
    expect(harness.readState().isAzureAuthRequired).toBe(false);
    expect(harness.options.setSystemNotice).toHaveBeenLastCalledWith(
      "Azure login completed.",
    );
  });

  it("reports pending tenant switch after interactive tenant change", async () => {
    const harness = createHarness();
    harness.options.activeAzureTenantIdRef.current = "tenant-a";
    vi.mocked(azureSessionApiClient.startSession).mockResolvedValue({
      message: "Azure login completed.",
    });
    vi.mocked(azureProjectsApiClient.loadProjects).mockResolvedValue({
      authRequired: false,
      tenantId: "tenant-b",
      principalId: "principal-b",
      principal: null,
      tenants: [],
      projects: [],
    });
    vi.mocked(azureSelectionApiClient.loadSelection).mockResolvedValue({
      selection: null,
    });

    await harness.handlers.handleAzureTenantChange("tenant-c");

    expect(vi.mocked(azureSessionApiClient.startSession)).toHaveBeenCalledWith(
      "tenant-c",
    );
    expect(harness.readState().azureTenantSwitchError).toBe(
      "Azure tenant switch is still applying. Retry Azure Login if this persists.",
    );
    expect(harness.readState().isSwitchingAzureTenant).toBe(false);
  });
});
