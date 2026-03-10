import type {
  Dispatch,
  MutableRefObject,
} from "react";
import {
  DEFAULT_UTILITY_REASONING_EFFORT,
} from "~/lib/constants/chat";
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
  ClientApiError,
  mapApiError,
} from "~/lib/client/infrastructure/api/api-client";
import {
  shouldScheduleWorkspaceMcpServerProfileLoginRetry,
} from "~/lib/client/usecase/workspace/mcp-profiles/selectors";
import { isLikelyChatAzureAuthError } from "./errors";
import type {
  AzureSelectionPreference,
} from "./parsers";
import {
  readAzureDeploymentList,
  readAzurePrincipalProfileFromUnknown,
  readAzureProjectList,
  readAzureSelectionFromUnknown,
  readAzureTenantList,
  readPrincipalIdFromUnknown,
  readTenantIdFromUnknown,
} from "./parsers";
import type {
  AzureSettingsAction,
} from "./reducer";
import {
  selectCachedAzureDeployments,
  selectCachedAzureProjectCatalog,
} from "./selectors";
import {
  buildAzureProjectsLoadResult,
  isAzureProjectsLoadReady,
  resolveAzureAuthRequiredState,
  resolveAzureTenantOptions,
  resolveInitialAzureProjectId,
  shouldUseCachedAzureProjectCatalog,
} from "./runtime";
import type {
  AzureSelectionSaveInput,
  AzureSettingsState,
  LoadAzureProjectsOptions,
  LoadAzureProjectsResult,
  UseAzureSettingsOptions,
} from "./types";

type AzureDeploymentTarget = "playground" | "utility";

type AzureSettingsHandlerDependencies = {
  options: UseAzureSettingsOptions;
  dispatch: Dispatch<AzureSettingsAction>;
  patchState: (patch: Partial<AzureSettingsState>) => void;
  readState: () => AzureSettingsState;
  preferredAzureSelectionRef: MutableRefObject<AzureSelectionPreference | null>;
  azureConnectionsRequestSeqRef: MutableRefObject<number>;
  playgroundAzureDeploymentRequestSeqRef: MutableRefObject<number>;
  utilityAzureDeploymentRequestSeqRef: MutableRefObject<number>;
  workspaceMcpServerProfileLoginRetryTimeoutRef: MutableRefObject<number | null>;
};

export type AzureSettingsHandlers = {
  cancelAzureDeploymentLoad: (target: AzureDeploymentTarget) => void;
  clearWorkspaceMcpServerProfileLoginRetryTimeout: () => void;
  saveAzureSelectionPreference: (
    selection: AzureSelectionSaveInput,
  ) => Promise<void>;
  saveThemePreference: (
    nextTheme: AzureSettingsState["theme"],
  ) => Promise<void>;
  loadAzureProjects: (
    options?: LoadAzureProjectsOptions,
  ) => Promise<LoadAzureProjectsResult>;
  loadAzureDeployments: (
    projectId: string,
    target: AzureDeploymentTarget,
    options?: {
      force?: boolean;
    },
  ) => Promise<void>;
  handleAzureLogin: () => Promise<void>;
  handleAzureTenantChange: (nextTenantId: string) => Promise<void>;
  handleAzureLogout: () => Promise<void>;
  handleReloadAzureCatalog: () => Promise<void>;
  handleSelectPlaygroundProject: (projectId: string) => void;
  handleSelectPlaygroundDeployment: (deploymentName: string) => void;
  handleSelectUtilityProject: (projectId: string) => void;
  handleSelectUtilityDeployment: (deploymentName: string) => void;
  handleUtilityReasoningEffortChange: (
    value: AzureSettingsState["utilityReasoningEffort"],
  ) => void;
};

export function createAzureSettingsHandlers(
  deps: AzureSettingsHandlerDependencies,
): AzureSettingsHandlers {
  function clearWorkspaceMcpServerProfileLoginRetryTimeout() {
    const timeoutId = deps.workspaceMcpServerProfileLoginRetryTimeoutRef.current;
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
      deps.workspaceMcpServerProfileLoginRetryTimeoutRef.current = null;
    }
  }

  function cancelAzureDeploymentLoad(target: AzureDeploymentTarget): void {
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

  async function loadAzureProjects(
    loadOptions: LoadAzureProjectsOptions = {},
  ): Promise<LoadAzureProjectsResult> {
    const currentState = deps.readState();
    const forceReload = loadOptions.force === true;
    const preferredTenantId = loadOptions.preferredTenantId?.trim() ?? "";
    const waitForWorkspaceStateReload =
      loadOptions.waitForWorkspaceStateReload === true;
    const useCachedProjectCatalog = shouldUseCachedAzureProjectCatalog({
      forceReload,
      isAzureAuthRequired: currentState.isAzureAuthRequired,
    });
    const requestSeq = deps.azureConnectionsRequestSeqRef.current + 1;
    deps.azureConnectionsRequestSeqRef.current = requestSeq;
    deps.patchState({
      isLoadingAzureConnections: true,
    });

    try {
      if (useCachedProjectCatalog) {
        const tenantIdForCache =
          preferredTenantId || deps.options.activeAzureTenantIdRef.current.trim();
        const cachedCatalog = selectCachedAzureProjectCatalog(
          deps.readState(),
          tenantIdForCache,
        );
        if (cachedCatalog) {
          const previousWorkspaceUserKey =
            deps.options.activeWorkspaceUserKeyRef.current;
          const nextWorkspaceUserKey = updateActiveAzureIdentity(
            cachedCatalog.tenantId,
            cachedCatalog.principalId,
          );
          await syncWorkspaceStateForLoadedIdentity({
            currentAuthRequired: currentState.isAzureAuthRequired,
            previousWorkspaceUserKey,
            nextWorkspaceUserKey,
            waitForWorkspaceStateReload,
          });

          const preferredSelection =
            cachedCatalog.tenantId && cachedCatalog.principalId
              ? await loadAzureSelectionPreference(
                  cachedCatalog.tenantId,
                  cachedCatalog.principalId,
                )
              : null;
          if (requestSeq !== deps.azureConnectionsRequestSeqRef.current) {
            return {
              authRequired: false,
              tenantSwitchPending: false,
            };
          }

          deps.preferredAzureSelectionRef.current = preferredSelection;
          const {
            nextPlaygroundProjectId,
            nextUtilityProjectId,
            preferredUtilityReasoningEffort,
          } = resolveProjectSelection({
            projects: cachedCatalog.projects,
            preferredSelection,
          });

          cancelAzureDeploymentLoads();
          deps.patchState({
            azureConnections: cachedCatalog.projects.map((project) => ({
              ...project,
            })),
            azureTenants: cachedCatalog.tenants.map((tenant) => ({
              ...tenant,
            })),
            activeAzurePrincipal: cachedCatalog.principal
              ? { ...cachedCatalog.principal }
              : null,
            playgroundAzureDeployments: [],
            utilityAzureDeployments: [],
            azureConnectionError: null,
            playgroundAzureDeploymentError: null,
            utilityAzureDeploymentError: null,
            utilityReasoningEffort: preferredUtilityReasoningEffort,
            selectedPlaygroundAzureConnectionId: nextPlaygroundProjectId,
            selectedUtilityAzureConnectionId: nextUtilityProjectId,
            theme: preferredSelection?.theme ?? currentState.theme,
          });
          return {
            authRequired: false,
            tenantSwitchPending: false,
          };
        }
      }

      const payload = await azureProjectsApiClient.loadProjects({
        preferredTenantId,
      });
      if (requestSeq !== deps.azureConnectionsRequestSeqRef.current) {
        return {
          authRequired: currentState.isAzureAuthRequired,
          tenantSwitchPending: false,
        };
      }

      const parsedProjects = readAzureProjectList(payload.projects);
      const tenantId = readTenantIdFromUnknown(payload.tenantId);
      const principalId = readPrincipalIdFromUnknown(payload.principalId);
      const loadResult = buildAzureProjectsLoadResult({
        authRequired: payload.authRequired === true,
        preferredTenantId,
        resolvedTenantId: tenantId,
      });
      if (loadResult.tenantSwitchPending) {
        deps.options.logClientWarning(
          "azure_tenant_switch_verification_pending",
          "Resolved tenant does not match requested tenant yet.",
          {
            action: "load_azure_projects",
            context: {
              requestedTenantId: preferredTenantId,
              resolvedTenantId: tenantId,
            },
          },
        );
        return loadResult;
      }

      const parsedTenants = resolveAzureTenantOptions(
        readAzureTenantList(payload.tenants),
        tenantId,
      );
      const parsedPrincipal =
        readAzurePrincipalProfileFromUnknown(
          payload.principal,
          tenantId,
          principalId,
        ) ??
        (tenantId && principalId
          ? {
              tenantId,
              principalId,
              displayName: principalId,
              principalName: "",
              principalType: "unknown" as const,
            }
          : null);
      const previousWorkspaceUserKey =
        deps.options.activeWorkspaceUserKeyRef.current;
      const nextWorkspaceUserKey = updateActiveAzureIdentity(
        tenantId,
        principalId,
      );
      await syncWorkspaceStateForLoadedIdentity({
        currentAuthRequired: currentState.isAzureAuthRequired,
        previousWorkspaceUserKey,
        nextWorkspaceUserKey,
        waitForWorkspaceStateReload,
      });

      const preferredSelection =
        tenantId && principalId
          ? await loadAzureSelectionPreference(tenantId, principalId)
          : null;
      if (requestSeq !== deps.azureConnectionsRequestSeqRef.current) {
        return {
          authRequired: payload.authRequired === true,
          tenantSwitchPending: false,
        };
      }

      deps.preferredAzureSelectionRef.current = preferredSelection;
      if (tenantId && principalId) {
        deps.dispatch({
          type: "project_cache/upsert",
          entry: {
            tenantId,
            principalId,
            principal: parsedPrincipal,
            tenants: parsedTenants,
            projects: parsedProjects,
          },
        });
      }

      const {
        nextPlaygroundProjectId,
        nextUtilityProjectId,
        preferredUtilityReasoningEffort,
      } = resolveProjectSelection({
        projects: parsedProjects,
        preferredSelection,
      });

      cancelAzureDeploymentLoads();
      deps.patchState({
        azureConnections: parsedProjects,
        azureTenants: parsedTenants,
        activeAzurePrincipal: parsedPrincipal,
        playgroundAzureDeployments: [],
        utilityAzureDeployments: [],
        isAzureAuthRequired: resolveAzureAuthRequiredState({
          currentAuthRequired: currentState.isAzureAuthRequired,
          nextAuthRequired: loadResult.authRequired,
          source: "projects_response",
        }),
        azureConnectionError: null,
        playgroundAzureDeploymentError: null,
        utilityAzureDeploymentError: null,
        utilityReasoningEffort: preferredUtilityReasoningEffort,
        selectedPlaygroundAzureConnectionId: nextPlaygroundProjectId,
        selectedUtilityAzureConnectionId: nextUtilityProjectId,
        theme: preferredSelection?.theme ?? currentState.theme,
      });
      return loadResult;
    } catch (loadError) {
      if (requestSeq !== deps.azureConnectionsRequestSeqRef.current) {
        return {
          authRequired: currentState.isAzureAuthRequired,
          tenantSwitchPending: false,
        };
      }

      deps.options.logClientError("load_azure_projects_failed", loadError, {
        action: "load_azure_projects",
      });
      const errorMessage = mapApiError(
        loadError,
        "Failed to load Azure projects.",
      );
      const nextAuthRequired =
        loadError instanceof ClientApiError
          ? loadError.kind === "auth_required"
          : isLikelyChatAzureAuthError(errorMessage);
      clearActiveAzureIdentity();
      deps.options.clearWorkspaceMcpServerProfilesState();
      deps.options.clearThreadsState(
        nextAuthRequired
          ? "Azure login is required. Open Settings and sign in to load threads."
          : null,
      );
      deps.patchState({
        isAzureAuthRequired: nextAuthRequired,
        azureConnections: [],
        playgroundAzureDeployments: [],
        utilityAzureDeployments: [],
        isLoadingPlaygroundAzureDeployments: false,
        isLoadingUtilityAzureDeployments: false,
        selectedPlaygroundAzureConnectionId: "",
        selectedPlaygroundAzureDeploymentName: "",
        selectedUtilityAzureConnectionId: "",
        selectedUtilityAzureDeploymentName: "",
        utilityReasoningEffort: DEFAULT_UTILITY_REASONING_EFFORT,
        azureConnectionError: nextAuthRequired ? null : errorMessage,
        playgroundAzureDeploymentError: null,
        utilityAzureDeploymentError: null,
      });
      return {
        authRequired: nextAuthRequired,
        tenantSwitchPending: false,
      };
    } finally {
      if (requestSeq === deps.azureConnectionsRequestSeqRef.current) {
        deps.patchState({
          isLoadingAzureConnections: false,
        });
      }
    }
  }

  function applyAzureDeployments(
    target: AzureDeploymentTarget,
    normalizedProjectId: string,
    deployments: AzureSettingsState["playgroundAzureDeployments"],
  ) {
    const preferredSelection = deps.preferredAzureSelectionRef.current;
    const preferredDeploymentName =
      preferredSelection &&
      preferredSelection.tenantId === deps.options.activeAzureTenantIdRef.current &&
      preferredSelection.principalId ===
        deps.options.activeAzurePrincipalIdRef.current &&
      (target === "playground"
        ? preferredSelection.playground?.projectId === normalizedProjectId
        : preferredSelection.utility?.projectId === normalizedProjectId)
        ? (
            target === "playground"
              ? preferredSelection.playground?.deploymentName
              : preferredSelection.utility?.deploymentName
          ) ?? ""
        : "";
    const currentState = deps.readState();

    deps.patchState(
      target === "playground"
        ? {
            isAzureAuthRequired: resolveAzureAuthRequiredState({
              currentAuthRequired: currentState.isAzureAuthRequired,
              nextAuthRequired: false,
              source: "background_success",
            }),
            playgroundAzureDeployments: deployments,
            selectedPlaygroundAzureDeploymentName: deployments.some(
              (deployment) =>
                deployment.name ===
                currentState.selectedPlaygroundAzureDeploymentName,
            )
              ? currentState.selectedPlaygroundAzureDeploymentName
              : preferredDeploymentName &&
                  deployments.some(
                    (deployment) => deployment.name === preferredDeploymentName,
                  )
                ? preferredDeploymentName
                : deployments[0]?.name ?? "",
            playgroundAzureDeploymentError:
              deployments.length === 0
                ? "No Agents SDK-compatible deployments found for this project."
                : null,
          }
        : {
            isAzureAuthRequired: resolveAzureAuthRequiredState({
              currentAuthRequired: currentState.isAzureAuthRequired,
              nextAuthRequired: false,
              source: "background_success",
            }),
            utilityAzureDeployments: deployments,
            selectedUtilityAzureDeploymentName: deployments.some(
              (deployment) =>
                deployment.name === currentState.selectedUtilityAzureDeploymentName,
            )
              ? currentState.selectedUtilityAzureDeploymentName
              : preferredDeploymentName &&
                  deployments.some(
                    (deployment) => deployment.name === preferredDeploymentName,
                  )
                ? preferredDeploymentName
                : deployments[0]?.name ?? "",
            utilityAzureDeploymentError:
              deployments.length === 0
                ? "No Agents SDK-compatible deployments found for this project."
                : null,
          },
    );
  }

  async function loadAzureDeployments(
    projectId: string,
    target: AzureDeploymentTarget,
    loadOptions: {
      force?: boolean;
    } = {},
  ): Promise<void> {
    const normalizedProjectId = projectId.trim();
    const forceReload = loadOptions.force !== false;
    if (!normalizedProjectId) {
      deps.patchState(
        target === "playground"
          ? {
              playgroundAzureDeployments: [],
              selectedPlaygroundAzureDeploymentName: "",
              playgroundAzureDeploymentError: null,
            }
          : {
              utilityAzureDeployments: [],
              selectedUtilityAzureDeploymentName: "",
              utilityAzureDeploymentError: null,
            },
      );
      return;
    }

    if (!forceReload) {
      const cachedDeployments = selectCachedAzureDeployments(
        deps.readState(),
        deps.options.activeAzureTenantIdRef.current,
        normalizedProjectId,
      );
      if (cachedDeployments) {
        applyAzureDeployments(target, normalizedProjectId, cachedDeployments);
        return;
      }
    }

    const requestSeq =
      target === "playground"
        ? deps.playgroundAzureDeploymentRequestSeqRef.current + 1
        : deps.utilityAzureDeploymentRequestSeqRef.current + 1;
    if (target === "playground") {
      deps.playgroundAzureDeploymentRequestSeqRef.current = requestSeq;
      deps.patchState({
        isLoadingPlaygroundAzureDeployments: true,
        playgroundAzureDeploymentError: null,
      });
    } else {
      deps.utilityAzureDeploymentRequestSeqRef.current = requestSeq;
      deps.patchState({
        isLoadingUtilityAzureDeployments: true,
        utilityAzureDeploymentError: null,
      });
    }

    try {
      const payload = await azureProjectsApiClient.loadDeployments(
        normalizedProjectId,
      );
      const activeRequestSeq =
        target === "playground"
          ? deps.playgroundAzureDeploymentRequestSeqRef.current
          : deps.utilityAzureDeploymentRequestSeqRef.current;
      if (requestSeq !== activeRequestSeq) {
        return;
      }

      const selectedProjectId =
        target === "playground"
          ? deps.options.selectedPlaygroundAzureConnectionIdRef.current.trim()
          : deps.options.selectedUtilityAzureConnectionIdRef.current.trim();
      if (!selectedProjectId || selectedProjectId !== normalizedProjectId) {
        return;
      }

      const parsedDeployments = readAzureDeploymentList(payload.deployments);
      const tenantIdFromPayload = readTenantIdFromUnknown(payload.tenantId);
      const principalIdFromPayload = readPrincipalIdFromUnknown(
        payload.principalId,
      );
      if (tenantIdFromPayload) {
        deps.options.activeAzureTenantIdRef.current = tenantIdFromPayload;
      }
      if (principalIdFromPayload) {
        deps.options.activeAzurePrincipalIdRef.current = principalIdFromPayload;
      }
      const parsedPrincipal = readAzurePrincipalProfileFromUnknown(
        payload.principal,
        deps.options.activeAzureTenantIdRef.current,
        deps.options.activeAzurePrincipalIdRef.current,
      );
      if (parsedPrincipal) {
        deps.patchState({
          activeAzurePrincipal: parsedPrincipal,
        });
      } else if (
        deps.options.activeAzureTenantIdRef.current &&
        deps.options.activeAzurePrincipalIdRef.current
      ) {
        deps.patchState({
          activeAzurePrincipal: {
            tenantId: deps.options.activeAzureTenantIdRef.current,
            principalId: deps.options.activeAzurePrincipalIdRef.current,
            displayName: deps.options.activeAzurePrincipalIdRef.current,
            principalName: "",
            principalType: "unknown",
          },
        });
      }
      deps.dispatch({
        type: "deployment_cache/upsert",
        tenantId: deps.options.activeAzureTenantIdRef.current,
        projectId: normalizedProjectId,
        deployments: parsedDeployments,
      });
      applyAzureDeployments(target, normalizedProjectId, parsedDeployments);
    } catch (loadError) {
      const activeRequestSeq =
        target === "playground"
          ? deps.playgroundAzureDeploymentRequestSeqRef.current
          : deps.utilityAzureDeploymentRequestSeqRef.current;
      if (requestSeq !== activeRequestSeq) {
        return;
      }

      deps.options.logClientError("load_azure_deployments_failed", loadError, {
        action: "load_azure_deployments",
        context: {
          target,
          projectId: normalizedProjectId,
        },
      });
      const authRequired =
        loadError instanceof ClientApiError &&
        loadError.kind === "auth_required";
      if (authRequired) {
        clearActiveAzureIdentity();
        deps.options.clearWorkspaceMcpServerProfilesState();
        deps.options.clearThreadsState(
          "Azure login is required. Open Settings and sign in to load threads.",
        );
      }

      deps.patchState(
        target === "playground"
          ? {
              isAzureAuthRequired: authRequired,
              playgroundAzureDeployments: [],
              selectedPlaygroundAzureDeploymentName: "",
              playgroundAzureDeploymentError: authRequired
                ? null
                : mapApiError(
                    loadError,
                    "Failed to load deployments for the selected project.",
                  ),
            }
          : {
              isAzureAuthRequired: authRequired,
              utilityAzureDeployments: [],
              selectedUtilityAzureDeploymentName: "",
              utilityAzureDeploymentError: authRequired
                ? null
                : mapApiError(
                    loadError,
                    "Failed to load deployments for the selected project.",
                  ),
            },
      );
    } finally {
      const activeRequestSeq =
        target === "playground"
          ? deps.playgroundAzureDeploymentRequestSeqRef.current
          : deps.utilityAzureDeploymentRequestSeqRef.current;
      if (requestSeq === activeRequestSeq) {
        deps.patchState(
          target === "playground"
            ? {
                isLoadingPlaygroundAzureDeployments: false,
              }
            : {
                isLoadingUtilityAzureDeployments: false,
              },
        );
      }
    }
  }

  async function runAzureLoginFlow(
    targetTenantIdRaw = "",
  ): Promise<LoadAzureProjectsResult> {
    const targetTenantId = targetTenantIdRaw.trim();
    const waitForWorkspaceStateReload = targetTenantId.length > 0;
    const payload = await azureSessionApiClient.startSession(targetTenantId);
    deps.options.setSystemNotice(
      targetTenantId
        ? "Azure tenant switched. Azure projects were refreshed."
        : payload.message || "Azure login completed.",
    );

    deps.patchState({
      isAzureAuthRequired: resolveAzureAuthRequiredState({
        currentAuthRequired: deps.readState().isAzureAuthRequired,
        nextAuthRequired: false,
        source: "interactive_login",
      }),
      azureConnectionError: null,
      playgroundAzureDeploymentError: null,
      utilityAzureDeploymentError: null,
    });

    let loadResult: LoadAzureProjectsResult = {
      authRequired: true,
      tenantSwitchPending: false,
    };
    for (let attempt = 0; attempt < 6; attempt += 1) {
      loadResult = await loadAzureProjects(
        targetTenantId
          ? {
              preferredTenantId: targetTenantId,
              force: true,
              waitForWorkspaceStateReload,
            }
          : {
              preferredTenantId: targetTenantId,
              waitForWorkspaceStateReload,
            },
      );
      if (isAzureProjectsLoadReady(loadResult)) {
        break;
      }

      await new Promise((resolve) => {
        window.setTimeout(resolve, 500);
      });
    }
    if (loadResult.authRequired) {
      deps.patchState({
        isAzureAuthRequired: true,
      });
    }

    deps.patchState({
      azureLoginError: null,
    });

    return loadResult;
  }

  return {
    cancelAzureDeploymentLoad,
    clearWorkspaceMcpServerProfileLoginRetryTimeout,
    saveAzureSelectionPreference,
    saveThemePreference,
    loadAzureProjects,
    loadAzureDeployments,
    async handleAzureLogin() {
      const currentState = deps.readState();
      if (
        currentState.isStartingAzureLogin ||
        currentState.isSwitchingAzureTenant
      ) {
        return;
      }

      deps.options.setSystemNotice(null);
      deps.patchState({
        azureLoginError: null,
        azureTenantSwitchError: null,
        isStartingAzureLogin: true,
      });
      try {
        await runAzureLoginFlow();
      } catch (loginError) {
        deps.options.logClientError("azure_login_flow_failed", loginError, {
          action: "azure_login",
        });
        deps.patchState({
          azureLoginError:
            loginError instanceof Error
              ? loginError.message
              : "Failed to start Azure login.",
        });
      } finally {
        deps.patchState({
          isStartingAzureLogin: false,
        });
      }
    },
    async handleAzureTenantChange(nextTenantIdRaw: string) {
      const currentState = deps.readState();
      if (
        currentState.isAzureAuthRequired ||
        currentState.isStartingAzureLogin ||
        currentState.isSwitchingAzureTenant ||
        currentState.isStartingAzureLogout
      ) {
        return;
      }

      const nextTenantId = nextTenantIdRaw.trim();
      const activeTenantId = deps.options.activeAzureTenantIdRef.current.trim();
      if (!nextTenantId || nextTenantId === activeTenantId) {
        return;
      }

      deps.options.setSystemNotice(null);
      deps.patchState({
        azureTenantSwitchError: null,
        azureLoginError: null,
        isSwitchingAzureTenant: true,
      });
      try {
        const loadResult = await runAzureLoginFlow(nextTenantId);
        if (loadResult.tenantSwitchPending) {
          deps.patchState({
            azureTenantSwitchError:
              "Azure tenant switch is still applying. Retry Azure Login if this persists.",
          });
        } else if (loadResult.authRequired) {
          deps.patchState({
            azureTenantSwitchError:
              "Failed to switch Azure tenant. Retry Azure Login.",
          });
        }
      } catch (switchError) {
        deps.options.logClientError(
          "azure_tenant_switch_failed",
          switchError,
          {
            action: "azure_tenant_switch",
            context: {
              tenantId: nextTenantId,
            },
          },
        );
        deps.patchState({
          azureTenantSwitchError:
            switchError instanceof Error
              ? switchError.message
              : "Failed to switch Azure tenant.",
        });
      } finally {
        deps.patchState({
          isSwitchingAzureTenant: false,
        });
      }
    },
    async handleAzureLogout() {
      const currentState = deps.readState();
      if (
        currentState.isStartingAzureLogout ||
        currentState.isSwitchingAzureTenant
      ) {
        return;
      }

      deps.options.setSystemNotice(null);
      deps.patchState({
        azureLogoutError: null,
        azureTenantSwitchError: null,
        isStartingAzureLogout: true,
      });
      try {
        const payload = await azureSessionApiClient.endSession();
        deps.patchState({
          playgroundAzureDeploymentError: null,
          utilityAzureDeploymentError: null,
        });
        await loadAzureProjects({ force: true });
        deps.options.setSystemNotice(payload.message || "Azure logout completed.");
      } catch (logoutError) {
        deps.options.logClientError("azure_logout_flow_failed", logoutError, {
          action: "azure_logout",
        });
        deps.patchState({
          azureLogoutError:
            logoutError instanceof Error
              ? logoutError.message
              : "Failed to run Azure logout.",
        });
      } finally {
        deps.patchState({
          isStartingAzureLogout: false,
        });
      }
    },
    async handleReloadAzureCatalog() {
      const currentState = deps.readState();
      if (
        currentState.isAzureAuthRequired ||
        currentState.isReloadingAzureCatalog ||
        currentState.isStartingAzureLogin ||
        currentState.isSwitchingAzureTenant ||
        currentState.isStartingAzureLogout ||
        currentState.isLoadingAzureConnections ||
        currentState.isLoadingPlaygroundAzureDeployments ||
        currentState.isLoadingUtilityAzureDeployments
      ) {
        return;
      }

      deps.options.setSystemNotice(null);
      deps.patchState({
        azureConnectionError: null,
        playgroundAzureDeploymentError: null,
        utilityAzureDeploymentError: null,
        azureTenantSwitchError: null,
        azureLoginError: null,
        isReloadingAzureCatalog: true,
      });

      try {
        deps.dispatch({
          type: "cache/clear_tenant",
          tenantId: deps.options.activeAzureTenantIdRef.current,
        });
        const loadResult = await loadAzureProjects({ force: true });
        if (isAzureProjectsLoadReady(loadResult)) {
          deps.options.setSystemNotice("Azure catalog reloaded.");
        }
      } finally {
        deps.patchState({
          isReloadingAzureCatalog: false,
        });
      }
    },
    handleSelectPlaygroundProject(projectId: string) {
      deps.patchState({
        selectedPlaygroundAzureConnectionId: projectId,
        selectedPlaygroundAzureDeploymentName: "",
        playgroundAzureDeploymentError: null,
      });
    },
    handleSelectPlaygroundDeployment(deploymentName: string) {
      deps.patchState({
        selectedPlaygroundAzureDeploymentName: deploymentName.trim(),
      });
    },
    handleSelectUtilityProject(projectId: string) {
      deps.patchState({
        selectedUtilityAzureConnectionId: projectId,
        selectedUtilityAzureDeploymentName: "",
        utilityAzureDeploymentError: null,
      });
    },
    handleSelectUtilityDeployment(deploymentName: string) {
      deps.patchState({
        selectedUtilityAzureDeploymentName: deploymentName.trim(),
      });
    },
    handleUtilityReasoningEffortChange(value) {
      deps.patchState({
        utilityReasoningEffort: value,
      });
    },
  };
}
