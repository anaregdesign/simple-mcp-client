import {
  DEFAULT_UTILITY_REASONING_EFFORT,
} from "~/lib/constants/chat";
import {
  azureSelectionApiClient,
} from "~/lib/client/infrastructure/api/azure-selection-api-client";
import {
  shouldScheduleWorkspaceMcpServerProfileLoginRetry,
} from "~/lib/client/usecase/workspace/mcp-profiles/selectors";
import type {
  AzureSelectionPreference,
} from "./parsers";
import {
  readAzureSelectionFromUnknown,
} from "./parsers";
import {
  resolveInitialAzureProjectId,
} from "./runtime";
import type {
  AzureSelectionSaveInput,
  AzureSettingsHandlerDependencies,
  AzureSettingsState,
} from "./types";

type AzureCatalogRuntime = {
  cancelAzureDeploymentLoad: (target: "playground" | "utility") => void;
  cancelAzureDeploymentLoads: () => void;
  clearActiveAzureIdentity: () => void;
  clearWorkspaceMcpServerProfileLoginRetryTimeout: () => void;
  loadAzureSelectionPreference: (
    tenantId: string,
    principalId: string,
  ) => Promise<AzureSelectionPreference | null>;
  resolveProjectSelection: (options: {
    projects: Array<{ id: string }>;
    preferredSelection: AzureSelectionPreference | null;
  }) => {
    nextPlaygroundProjectId: string;
    nextUtilityProjectId: string;
    preferredUtilityReasoningEffort: AzureSettingsState["utilityReasoningEffort"];
  };
  saveAzureSelectionPreference: (
    selection: AzureSelectionSaveInput,
  ) => Promise<void>;
  saveThemePreference: (
    nextTheme: AzureSettingsState["theme"],
  ) => Promise<void>;
  syncWorkspaceStateForLoadedIdentity: (options: {
    currentAuthRequired: boolean;
    previousWorkspaceUserKey: string;
    nextWorkspaceUserKey: string;
    waitForWorkspaceStateReload: boolean;
  }) => Promise<void>;
  updateActiveAzureIdentity: (tenantId: string, principalId: string) => string;
};

export function createAzureCatalogRuntime(
  deps: AzureSettingsHandlerDependencies,
): AzureCatalogRuntime {
  function clearWorkspaceMcpServerProfileLoginRetryTimeout() {
    const timeoutId = deps.workspaceMcpServerProfileLoginRetryTimeoutRef.current;
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
      deps.workspaceMcpServerProfileLoginRetryTimeoutRef.current = null;
    }
  }

  function cancelAzureDeploymentLoad(target: "playground" | "utility"): void {
    if (target === "playground") {
      deps.playgroundAzureDeploymentRequestSeqRef.current += 1;
      deps.patchState({
        isLoadingPlaygroundAzureDeployments: false,
      });
      return;
    }

    deps.utilityAzureDeploymentRequestSeqRef.current += 1;
    deps.patchState({
      isLoadingUtilityAzureDeployments: false,
    });
  }

  function cancelAzureDeploymentLoads(): void {
    cancelAzureDeploymentLoad("playground");
    cancelAzureDeploymentLoad("utility");
  }

  function clearActiveAzureIdentity(): void {
    deps.options.activeAzureTenantIdRef.current = "";
    deps.options.activeAzurePrincipalIdRef.current = "";
    deps.options.activeWorkspaceUserKeyRef.current = "";
    deps.preferredAzureSelectionRef.current = null;
    cancelAzureDeploymentLoads();
    deps.dispatch({ type: "cache/clear_all" });
    deps.patchState({
      azureTenants: [],
      activeAzurePrincipal: null,
      azureTenantSwitchError: null,
      isReloadingAzureCatalog: false,
      utilityReasoningEffort: DEFAULT_UTILITY_REASONING_EFFORT,
    });
  }

  function updateActiveAzureIdentity(
    tenantId: string,
    principalId: string,
  ): string {
    deps.options.activeAzureTenantIdRef.current = tenantId;
    deps.options.activeAzurePrincipalIdRef.current = principalId;
    const nextWorkspaceUserKey =
      tenantId && principalId ? `${tenantId}::${principalId}` : "";
    deps.options.activeWorkspaceUserKeyRef.current = nextWorkspaceUserKey;
    return nextWorkspaceUserKey;
  }

  async function reloadWorkspaceStateForActiveIdentity(
    waitForWorkspaceStateReload: boolean,
  ): Promise<void> {
    deps.options.clearWorkspaceMcpServerProfilesState();
    deps.options.clearThreadsState();

    const nextWorkspaceUserKey =
      deps.options.activeWorkspaceUserKeyRef.current.trim();
    if (!nextWorkspaceUserKey) {
      return;
    }

    deps.options.showThreadReloadPlaceholder();

    const reloadState = async () => {
      await deps.options.loadWorkspaceMcpServerProfiles();
      await deps.options.loadThreads();
    };

    if (waitForWorkspaceStateReload) {
      await reloadState();
      return;
    }

    void reloadState();
  }

  function scheduleWorkspaceMcpServerProfileLoginRetry(expectedUserKey: string) {
    clearWorkspaceMcpServerProfileLoginRetryTimeout();
    deps.workspaceMcpServerProfileLoginRetryTimeoutRef.current =
      window.setTimeout(() => {
        deps.workspaceMcpServerProfileLoginRetryTimeoutRef.current = null;
        if (deps.options.activeWorkspaceUserKeyRef.current === expectedUserKey) {
          void deps.options.loadWorkspaceMcpServerProfiles();
        }
      }, 1200);
  }

  async function syncWorkspaceStateForLoadedIdentity(options: {
    currentAuthRequired: boolean;
    previousWorkspaceUserKey: string;
    nextWorkspaceUserKey: string;
    waitForWorkspaceStateReload: boolean;
  }) {
    if (!options.nextWorkspaceUserKey) {
      deps.options.clearWorkspaceMcpServerProfilesState();
      deps.options.clearThreadsState();
    } else if (
      options.previousWorkspaceUserKey !== options.nextWorkspaceUserKey
    ) {
      await reloadWorkspaceStateForActiveIdentity(
        options.waitForWorkspaceStateReload,
      );
    } else if (
      !deps.options.readIsThreadsReady() &&
      !deps.options.readIsLoadingThreads() &&
      deps.readState().isAzureAuthRequired === false
    ) {
      if (options.waitForWorkspaceStateReload) {
        await deps.options.loadThreads();
      } else {
        void deps.options.loadThreads();
      }
    }

    if (
      shouldScheduleWorkspaceMcpServerProfileLoginRetry(
        options.currentAuthRequired,
        options.nextWorkspaceUserKey,
      )
    ) {
      scheduleWorkspaceMcpServerProfileLoginRetry(options.nextWorkspaceUserKey);
    } else {
      clearWorkspaceMcpServerProfileLoginRetryTimeout();
    }
  }

  async function loadAzureSelectionPreference(
    tenantId: string,
    principalId: string,
  ): Promise<AzureSelectionPreference | null> {
    const normalizedTenantId = tenantId.trim();
    const normalizedPrincipalId = principalId.trim();
    if (!normalizedTenantId || !normalizedPrincipalId) {
      return null;
    }

    try {
      const payload = await azureSelectionApiClient.loadSelection();
      return readAzureSelectionFromUnknown(
        payload.selection,
        normalizedTenantId,
        normalizedPrincipalId,
      );
    } catch (selectionError) {
      deps.options.logClientError(
        "load_azure_selection_failed",
        selectionError,
        {
          action: "load_azure_selection",
        },
      );
      return null;
    }
  }

  async function saveAzureSelectionPreference(
    selection: AzureSelectionSaveInput,
  ): Promise<void> {
    const currentPreferredSelection = deps.preferredAzureSelectionRef.current;
    const hasIdentityScopedPreferredSelection =
      currentPreferredSelection !== null &&
      currentPreferredSelection.tenantId === selection.tenantId &&
      currentPreferredSelection.principalId === selection.principalId;
    const nextPreferredSelection = hasIdentityScopedPreferredSelection
      ? {
          ...currentPreferredSelection,
          theme: currentPreferredSelection.theme,
          playground: currentPreferredSelection.playground
            ? { ...currentPreferredSelection.playground }
            : null,
          utility: currentPreferredSelection.utility
            ? { ...currentPreferredSelection.utility }
            : null,
        }
      : {
          tenantId: selection.tenantId,
          principalId: selection.principalId,
          theme: deps.readState().theme,
          playground: null,
          utility: null,
        };

    const targetSelection = {
      projectId: selection.projectId,
      deploymentName: selection.deploymentName,
    };
    if (selection.target === "playground") {
      nextPreferredSelection.playground = targetSelection;
    } else {
      nextPreferredSelection.utility = {
        ...targetSelection,
        reasoningEffort: selection.reasoningEffort,
      };
    }
    deps.preferredAzureSelectionRef.current = nextPreferredSelection;
    const persistedThemeMode = hasIdentityScopedPreferredSelection
      ? currentPreferredSelection.theme
      : null;

    try {
      if (selection.target === "utility") {
        await azureSelectionApiClient.saveSelection({
          target: "utility",
          projectId: selection.projectId,
          deploymentName: selection.deploymentName,
          reasoningEffort: selection.reasoningEffort,
          theme: persistedThemeMode,
        });
      } else {
        await azureSelectionApiClient.saveSelection({
          target: "playground",
          projectId: selection.projectId,
          deploymentName: selection.deploymentName,
          theme: persistedThemeMode,
        });
      }
    } catch (selectionSaveError) {
      deps.options.logClientError(
        "save_azure_selection_failed",
        selectionSaveError,
        {
          action: "save_azure_selection",
        },
      );
    }
  }

  async function saveThemePreference(
    nextTheme: AzureSettingsState["theme"],
  ): Promise<void> {
    const tenantId = deps.options.activeAzureTenantIdRef.current.trim();
    const principalId = deps.options.activeAzurePrincipalIdRef.current.trim();
    if (!tenantId || !principalId) {
      return;
    }

    const currentPreferredSelection = deps.preferredAzureSelectionRef.current;
    deps.preferredAzureSelectionRef.current =
      currentPreferredSelection &&
      currentPreferredSelection.tenantId === tenantId &&
      currentPreferredSelection.principalId === principalId
        ? {
            ...currentPreferredSelection,
            theme: nextTheme,
            playground: currentPreferredSelection.playground
              ? { ...currentPreferredSelection.playground }
              : null,
            utility: currentPreferredSelection.utility
              ? { ...currentPreferredSelection.utility }
              : null,
          }
        : {
            tenantId,
            principalId,
            theme: nextTheme,
            playground: null,
            utility: null,
          };

    try {
      await azureSelectionApiClient.saveSelection({
        theme: nextTheme,
      });
    } catch (selectionSaveError) {
      deps.options.logClientError("save_theme_failed", selectionSaveError, {
        action: "save_theme",
      });
    }
  }

  function resolveProjectSelection(options: {
    projects: Array<{ id: string }>;
    preferredSelection: AzureSelectionPreference | null;
  }) {
    const preferredPlaygroundProjectId =
      options.preferredSelection?.playground?.projectId ?? "";
    const preferredUtilityProjectId =
      options.preferredSelection?.utility?.projectId ?? "";
    const preferredUtilityReasoningEffort =
      options.preferredSelection?.utility?.reasoningEffort ??
      DEFAULT_UTILITY_REASONING_EFFORT;
    const knownProjectIds = new Set(
      options.projects.map((connection) => connection.id),
    );
    const defaultProjectId = options.projects[0]?.id ?? "";
    const nextPlaygroundProjectId = resolveInitialAzureProjectId({
      knownProjectIds,
      currentProjectId:
        deps.options.selectedPlaygroundAzureConnectionIdRef.current,
      preferredProjectId: preferredPlaygroundProjectId,
      defaultProjectId,
    });
    const nextUtilityProjectId = resolveInitialAzureProjectId({
      knownProjectIds,
      currentProjectId:
        deps.options.selectedUtilityAzureConnectionIdRef.current,
      preferredProjectId: preferredUtilityProjectId,
      fallbackProjectId: nextPlaygroundProjectId,
      defaultProjectId,
    });

    return {
      nextPlaygroundProjectId,
      nextUtilityProjectId,
      preferredUtilityReasoningEffort,
    };
  }

  return {
    cancelAzureDeploymentLoad,
    cancelAzureDeploymentLoads,
    clearActiveAzureIdentity,
    clearWorkspaceMcpServerProfileLoginRetryTimeout,
    loadAzureSelectionPreference,
    resolveProjectSelection,
    saveAzureSelectionPreference,
    saveThemePreference,
    syncWorkspaceStateForLoadedIdentity,
    updateActiveAzureIdentity,
  };
}
