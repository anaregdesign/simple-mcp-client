import {
  useEffect,
  useEffectEvent,
  useReducer,
  useRef,
} from "react";
import {
  DEFAULT_UTILITY_REASONING_EFFORT,
} from "~/lib/constants/chat";
import { MCP_DEFAULT_TIMEOUT_SECONDS } from "~/lib/constants/mcp";
import type { ReasoningEffort } from "~/lib/client/usecase/workspace/view-types";
import {
  azureProjectsApiClient,
} from "~/lib/client/infrastructure/api/azure-projects-api-client";
import {
  azureSelectionApiClient,
} from "~/lib/client/infrastructure/api/azure-selection-api-client";
import {
  azureSessionApiClient,
} from "~/lib/client/infrastructure/api/azure-session-api-client";
import { ClientApiError, mapApiError } from "~/lib/client/infrastructure/api/api-client";
import { isLikelyChatAzureAuthError } from "~/lib/client/usecase/workspace/azure-errors";
import {
  buildAzureProjectsLoadResult,
  isAzureProjectsLoadReady,
  resolveAzureAuthRequiredState,
  resolveAzureTenantOptions,
  resolveInitialAzureProjectId,
  shouldUseCachedAzureProjectCatalog,
} from "~/lib/client/usecase/workspace/azure-runtime";
import {
  readAzureDeploymentList,
  readAzurePrincipalProfileFromUnknown,
  readPrincipalIdFromUnknown,
  readAzureProjectList,
  type AzureSelectionPreference,
  readAzureSelectionFromUnknown,
  readAzureTenantList,
  readTenantIdFromUnknown,
} from "~/lib/client/usecase/workspace/azure-parsers";
import {
  shouldScheduleWorkspaceMcpServerProfileLoginRetry,
} from "~/lib/client/usecase/workspace/workspace-mcp-server-profiles";
import {
  azureSettingsReducer,
  createInitialAzureSettingsReducerState,
} from "./reducer";
import {
  filterReasoningEffortOptionsForDeploymentCompatibility,
  includesAzureDeploymentName,
  resolveEffectiveReasoningEffort,
  resolveSupportedReasoningEffortOptions,
  selectActiveAzureConnection,
  selectCachedAzureDeployments,
  selectCachedAzureProjectCatalog,
} from "./selectors";
import type {
  AzureSelectionSaveInput,
  AzureSettingsController,
  AzureSettingsState,
  LoadAzureProjectsOptions,
  LoadAzureProjectsResult,
  UseAzureSettingsOptions,
} from "./types";

export function useAzureSettings(
  options: UseAzureSettingsOptions,
): AzureSettingsController {
  const [state, dispatch] = useReducer(
    azureSettingsReducer,
    undefined,
    createInitialAzureSettingsReducerState,
  );
  const stateRef = useRef<AzureSettingsState>(state);
  const preferredAzureSelectionRef = useRef<AzureSelectionPreference | null>(
    null,
  );
  const azureConnectionsRequestSeqRef = useRef(0);
  const playgroundAzureDeploymentRequestSeqRef = useRef(0);
  const utilityAzureDeploymentRequestSeqRef = useRef(0);
  const workspaceMcpServerProfileLoginRetryTimeoutRef =
    useRef<number | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const activePlaygroundAzureConnection = selectActiveAzureConnection(
    state.azureConnections,
    state.selectedPlaygroundAzureConnectionId,
  );
  const activeUtilityAzureConnection = selectActiveAzureConnection(
    state.azureConnections,
    state.selectedUtilityAzureConnectionId,
  );
  const playgroundAzureDeploymentNames = state.playgroundAzureDeployments.map(
    (deployment) => deployment.name,
  );
  const utilityAzureDeploymentNames = state.utilityAzureDeployments.map(
    (deployment) => deployment.name,
  );
  const selectedUtilityAzureDeployment = state.utilityAzureDeployments.find(
    (deployment) =>
      deployment.name === state.selectedUtilityAzureDeploymentName,
  );
  const selectedUtilityDeploymentCompatibleReasoningEffortOptions =
    filterReasoningEffortOptionsForDeploymentCompatibility(
      resolveSupportedReasoningEffortOptions(
        selectedUtilityAzureDeployment?.reasoningEffortOptions ?? [],
      ),
      state.selectedUtilityAzureDeploymentName,
    );
  const isUtilityReasoningEffortSupported =
    selectedUtilityDeploymentCompatibleReasoningEffortOptions.length > 0;
  const effectiveUtilityReasoningEffortOptions: ReasoningEffort[] =
    isUtilityReasoningEffortSupported
      ? selectedUtilityDeploymentCompatibleReasoningEffortOptions
      : ["none"];
  const effectiveUtilityReasoningEffort = resolveEffectiveReasoningEffort(
    state.utilityReasoningEffort,
    effectiveUtilityReasoningEffortOptions,
    DEFAULT_UTILITY_REASONING_EFFORT,
  );

  function patchState(patch: Partial<AzureSettingsState>) {
    dispatch({
      type: "state/patch",
      patch,
    });
  }

  function clearWorkspaceMcpServerProfileLoginRetryTimeout() {
    const timeoutId = workspaceMcpServerProfileLoginRetryTimeoutRef.current;
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
      workspaceMcpServerProfileLoginRetryTimeoutRef.current = null;
    }
  }

  const loadAzureSelectionPreference = useEffectEvent(
    async (
      tenantId: string,
      principalId: string,
    ) => {
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
        options.logClientError("load_azure_selection_failed", selectionError, {
          action: "load_azure_selection",
        });
        return null;
      }
    },
  );

  const saveAzureSelectionPreference = useEffectEvent(
    async (selection: AzureSelectionSaveInput): Promise<void> => {
      const currentPreferredSelection = preferredAzureSelectionRef.current;
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
            theme: stateRef.current.theme,
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
      preferredAzureSelectionRef.current = nextPreferredSelection;
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
        options.logClientError(
          "save_azure_selection_failed",
          selectionSaveError,
          {
            action: "save_azure_selection",
          },
        );
      }
    },
  );

  const saveThemePreference = useEffectEvent(
    async (nextTheme: AzureSettingsState["theme"]): Promise<void> => {
      const tenantId = options.activeAzureTenantIdRef.current.trim();
      const principalId = options.activeAzurePrincipalIdRef.current.trim();
      if (!tenantId || !principalId) {
        return;
      }

      const currentPreferredSelection = preferredAzureSelectionRef.current;
      preferredAzureSelectionRef.current =
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
        options.logClientError("save_theme_failed", selectionSaveError, {
          action: "save_theme",
        });
      }
    },
  );

  function cancelAzureDeploymentLoad(target: "playground" | "utility"): void {
    if (target === "playground") {
      playgroundAzureDeploymentRequestSeqRef.current += 1;
      patchState({
        isLoadingPlaygroundAzureDeployments: false,
      });
      return;
    }

    utilityAzureDeploymentRequestSeqRef.current += 1;
    patchState({
      isLoadingUtilityAzureDeployments: false,
    });
  }

  function cancelAzureDeploymentLoads(): void {
    cancelAzureDeploymentLoad("playground");
    cancelAzureDeploymentLoad("utility");
  }

  function clearActiveAzureIdentity(): void {
    options.activeAzureTenantIdRef.current = "";
    options.activeAzurePrincipalIdRef.current = "";
    options.activeWorkspaceUserKeyRef.current = "";
    preferredAzureSelectionRef.current = null;
    cancelAzureDeploymentLoads();
    dispatch({ type: "cache/clear_all" });
    patchState({
      azureTenants: [],
      activeAzurePrincipal: null,
      azureTenantSwitchError: null,
      isReloadingAzureCatalog: false,
      utilityReasoningEffort: DEFAULT_UTILITY_REASONING_EFFORT,
    });
  }

  function updateActiveAzureIdentity(tenantId: string, principalId: string): string {
    options.activeAzureTenantIdRef.current = tenantId;
    options.activeAzurePrincipalIdRef.current = principalId;
    const nextWorkspaceUserKey =
      tenantId && principalId ? `${tenantId}::${principalId}` : "";
    options.activeWorkspaceUserKeyRef.current = nextWorkspaceUserKey;
    return nextWorkspaceUserKey;
  }

  async function reloadWorkspaceStateForActiveIdentity(
    waitForWorkspaceStateReload: boolean,
  ): Promise<void> {
    options.clearWorkspaceMcpServerProfilesState();
    options.clearThreadsState();

    const nextWorkspaceUserKey = options.activeWorkspaceUserKeyRef.current.trim();
    if (!nextWorkspaceUserKey) {
      return;
    }

    options.showThreadReloadPlaceholder();

    const reloadState = async () => {
      await options.loadWorkspaceMcpServerProfiles();
      await options.loadThreads();
    };

    if (waitForWorkspaceStateReload) {
      await reloadState();
      return;
    }

    void reloadState();
  }

  function scheduleWorkspaceMcpServerProfileLoginRetry(expectedUserKey: string) {
    clearWorkspaceMcpServerProfileLoginRetryTimeout();
    workspaceMcpServerProfileLoginRetryTimeoutRef.current = window.setTimeout(
      () => {
        workspaceMcpServerProfileLoginRetryTimeoutRef.current = null;
        if (options.activeWorkspaceUserKeyRef.current === expectedUserKey) {
          void options.loadWorkspaceMcpServerProfiles();
        }
      },
      1200,
    );
  }

  const loadAzureProjects = useEffectEvent(
    async (
      loadOptions: LoadAzureProjectsOptions = {},
    ): Promise<LoadAzureProjectsResult> => {
      const currentState = stateRef.current;
      const forceReload = loadOptions.force === true;
      const preferredTenantId = loadOptions.preferredTenantId?.trim() ?? "";
      const waitForWorkspaceStateReload =
        loadOptions.waitForWorkspaceStateReload === true;
      const useCachedProjectCatalog = shouldUseCachedAzureProjectCatalog({
        forceReload,
        isAzureAuthRequired: currentState.isAzureAuthRequired,
      });
      const requestSeq = azureConnectionsRequestSeqRef.current + 1;
      azureConnectionsRequestSeqRef.current = requestSeq;
      patchState({
        isLoadingAzureConnections: true,
      });

      try {
        if (useCachedProjectCatalog) {
          const tenantIdForCache =
            preferredTenantId || options.activeAzureTenantIdRef.current.trim();
          const cachedCatalog = selectCachedAzureProjectCatalog(
            stateRef.current,
            tenantIdForCache,
          );
          if (cachedCatalog) {
            const previousWorkspaceUserKey =
              options.activeWorkspaceUserKeyRef.current;
            const nextWorkspaceUserKey = updateActiveAzureIdentity(
              cachedCatalog.tenantId,
              cachedCatalog.principalId,
            );
            if (!nextWorkspaceUserKey) {
              options.clearWorkspaceMcpServerProfilesState();
              options.clearThreadsState();
            } else if (previousWorkspaceUserKey !== nextWorkspaceUserKey) {
              await reloadWorkspaceStateForActiveIdentity(
                waitForWorkspaceStateReload,
              );
            } else if (
              !options.readIsThreadsReady() &&
              !options.readIsLoadingThreads() &&
              stateRef.current.isAzureAuthRequired === false
            ) {
              if (waitForWorkspaceStateReload) {
                await options.loadThreads();
              } else {
                void options.loadThreads();
              }
            }
            if (
              shouldScheduleWorkspaceMcpServerProfileLoginRetry(
                currentState.isAzureAuthRequired,
                nextWorkspaceUserKey,
              )
            ) {
              scheduleWorkspaceMcpServerProfileLoginRetry(nextWorkspaceUserKey);
            } else {
              clearWorkspaceMcpServerProfileLoginRetryTimeout();
            }
            const preferredSelection =
              cachedCatalog.tenantId && cachedCatalog.principalId
                ? await loadAzureSelectionPreference(
                    cachedCatalog.tenantId,
                    cachedCatalog.principalId,
                  )
                : null;
            if (requestSeq !== azureConnectionsRequestSeqRef.current) {
              return {
                authRequired: false,
                tenantSwitchPending: false,
              };
            }
            preferredAzureSelectionRef.current = preferredSelection;
            const preferredPlaygroundProjectId =
              preferredSelection?.playground?.projectId ?? "";
            const preferredUtilityProjectId =
              preferredSelection?.utility?.projectId ?? "";
            const preferredUtilityReasoningEffort =
              preferredSelection?.utility?.reasoningEffort ??
              DEFAULT_UTILITY_REASONING_EFFORT;
            const knownProjectIds = new Set(
              cachedCatalog.projects.map((connection) => connection.id),
            );
            const defaultProjectId = cachedCatalog.projects[0]?.id ?? "";
            const nextPlaygroundProjectId = resolveInitialAzureProjectId({
              knownProjectIds,
              currentProjectId:
                options.selectedPlaygroundAzureConnectionIdRef.current,
              preferredProjectId: preferredPlaygroundProjectId,
              defaultProjectId,
            });
            const nextUtilityProjectId = resolveInitialAzureProjectId({
              knownProjectIds,
              currentProjectId:
                options.selectedUtilityAzureConnectionIdRef.current,
              preferredProjectId: preferredUtilityProjectId,
              fallbackProjectId: nextPlaygroundProjectId,
              defaultProjectId,
            });

            cancelAzureDeploymentLoads();
            patchState({
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
        if (requestSeq !== azureConnectionsRequestSeqRef.current) {
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
          options.logClientWarning(
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
          options.activeWorkspaceUserKeyRef.current;
        const nextWorkspaceUserKey = updateActiveAzureIdentity(
          tenantId,
          principalId,
        );
        if (!nextWorkspaceUserKey) {
          options.clearWorkspaceMcpServerProfilesState();
          options.clearThreadsState();
        } else if (previousWorkspaceUserKey !== nextWorkspaceUserKey) {
          await reloadWorkspaceStateForActiveIdentity(waitForWorkspaceStateReload);
        } else if (
          !options.readIsThreadsReady() &&
          !options.readIsLoadingThreads()
        ) {
          if (waitForWorkspaceStateReload) {
            await options.loadThreads();
          } else {
            void options.loadThreads();
          }
        }
        if (
          shouldScheduleWorkspaceMcpServerProfileLoginRetry(
            currentState.isAzureAuthRequired,
            nextWorkspaceUserKey,
          )
        ) {
          scheduleWorkspaceMcpServerProfileLoginRetry(nextWorkspaceUserKey);
        } else {
          clearWorkspaceMcpServerProfileLoginRetryTimeout();
        }
        const preferredSelection =
          tenantId && principalId
            ? await loadAzureSelectionPreference(tenantId, principalId)
            : null;
        if (requestSeq !== azureConnectionsRequestSeqRef.current) {
          return {
            authRequired: payload.authRequired === true,
            tenantSwitchPending: false,
          };
        }

        preferredAzureSelectionRef.current = preferredSelection;
        if (tenantId && principalId) {
          dispatch({
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
        const preferredPlaygroundProjectId =
          preferredSelection?.playground?.projectId ?? "";
        const preferredUtilityProjectId =
          preferredSelection?.utility?.projectId ?? "";
        const preferredUtilityReasoningEffort =
          preferredSelection?.utility?.reasoningEffort ??
          DEFAULT_UTILITY_REASONING_EFFORT;
        const knownProjectIds = new Set(
          parsedProjects.map((connection) => connection.id),
        );
        const defaultProjectId = parsedProjects[0]?.id ?? "";
        const nextPlaygroundProjectId = resolveInitialAzureProjectId({
          knownProjectIds,
          currentProjectId: options.selectedPlaygroundAzureConnectionIdRef.current,
          preferredProjectId: preferredPlaygroundProjectId,
          defaultProjectId,
        });
        const nextUtilityProjectId = resolveInitialAzureProjectId({
          knownProjectIds,
          currentProjectId: options.selectedUtilityAzureConnectionIdRef.current,
          preferredProjectId: preferredUtilityProjectId,
          fallbackProjectId: nextPlaygroundProjectId,
          defaultProjectId,
        });

        cancelAzureDeploymentLoads();
        patchState({
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
        if (requestSeq !== azureConnectionsRequestSeqRef.current) {
          return {
            authRequired: currentState.isAzureAuthRequired,
            tenantSwitchPending: false,
          };
        }

        options.logClientError("load_azure_projects_failed", loadError, {
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
        options.clearWorkspaceMcpServerProfilesState();
        options.clearThreadsState(
          nextAuthRequired
            ? "Azure login is required. Open Settings and sign in to load threads."
            : null,
        );
        patchState({
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
        if (requestSeq === azureConnectionsRequestSeqRef.current) {
          patchState({
            isLoadingAzureConnections: false,
          });
        }
      }
    },
  );

  const loadAzureDeployments = useEffectEvent(
    async (
      projectId: string,
      target: "playground" | "utility",
      loadOptions: {
        force?: boolean;
      } = {},
    ): Promise<void> => {
      const currentState = stateRef.current;
      const normalizedProjectId = projectId.trim();
      const forceReload = loadOptions.force !== false;
      if (!normalizedProjectId) {
        patchState(
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

      const applyDeployments = (deployments: typeof currentState.playgroundAzureDeployments) => {
        const preferredSelection = preferredAzureSelectionRef.current;
        const preferredDeploymentName =
          preferredSelection &&
          preferredSelection.tenantId === options.activeAzureTenantIdRef.current &&
          preferredSelection.principalId === options.activeAzurePrincipalIdRef.current &&
          (target === "playground"
            ? preferredSelection.playground?.projectId === normalizedProjectId
            : preferredSelection.utility?.projectId === normalizedProjectId)
            ? ((target === "playground"
                ? preferredSelection.playground?.deploymentName
                : preferredSelection.utility?.deploymentName) ?? "")
            : "";

        patchState(
          target === "playground"
            ? {
                isAzureAuthRequired: resolveAzureAuthRequiredState({
                  currentAuthRequired: stateRef.current.isAzureAuthRequired,
                  nextAuthRequired: false,
                  source: "background_success",
                }),
                playgroundAzureDeployments: deployments,
                selectedPlaygroundAzureDeploymentName: deployments.some(
                  (deployment) =>
                    deployment.name ===
                    stateRef.current.selectedPlaygroundAzureDeploymentName,
                )
                  ? stateRef.current.selectedPlaygroundAzureDeploymentName
                  : preferredDeploymentName &&
                      deployments.some(
                        (deployment) =>
                          deployment.name === preferredDeploymentName,
                      )
                    ? preferredDeploymentName
                    : (deployments[0]?.name ?? ""),
                playgroundAzureDeploymentError:
                  deployments.length === 0
                    ? "No Agents SDK-compatible deployments found for this project."
                    : null,
              }
            : {
                isAzureAuthRequired: resolveAzureAuthRequiredState({
                  currentAuthRequired: stateRef.current.isAzureAuthRequired,
                  nextAuthRequired: false,
                  source: "background_success",
                }),
                utilityAzureDeployments: deployments,
                selectedUtilityAzureDeploymentName: deployments.some(
                  (deployment) =>
                    deployment.name ===
                    stateRef.current.selectedUtilityAzureDeploymentName,
                )
                  ? stateRef.current.selectedUtilityAzureDeploymentName
                  : preferredDeploymentName &&
                      deployments.some(
                        (deployment) =>
                          deployment.name === preferredDeploymentName,
                      )
                    ? preferredDeploymentName
                    : (deployments[0]?.name ?? ""),
                utilityAzureDeploymentError:
                  deployments.length === 0
                    ? "No Agents SDK-compatible deployments found for this project."
                    : null,
              },
        );
      };

      if (!forceReload) {
        const cachedDeployments = selectCachedAzureDeployments(
          stateRef.current,
          options.activeAzureTenantIdRef.current,
          normalizedProjectId,
        );
        if (cachedDeployments) {
          applyDeployments(cachedDeployments);
          return;
        }
      }

      const requestSeq =
        target === "playground"
          ? playgroundAzureDeploymentRequestSeqRef.current + 1
          : utilityAzureDeploymentRequestSeqRef.current + 1;
      if (target === "playground") {
        playgroundAzureDeploymentRequestSeqRef.current = requestSeq;
        patchState({
          isLoadingPlaygroundAzureDeployments: true,
          playgroundAzureDeploymentError: null,
        });
      } else {
        utilityAzureDeploymentRequestSeqRef.current = requestSeq;
        patchState({
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
            ? playgroundAzureDeploymentRequestSeqRef.current
            : utilityAzureDeploymentRequestSeqRef.current;
        if (requestSeq !== activeRequestSeq) {
          return;
        }

        const selectedProjectId =
          target === "playground"
            ? options.selectedPlaygroundAzureConnectionIdRef.current.trim()
            : options.selectedUtilityAzureConnectionIdRef.current.trim();
        if (!selectedProjectId || selectedProjectId !== normalizedProjectId) {
          return;
        }

        const parsedDeployments = readAzureDeploymentList(payload.deployments);
        const tenantIdFromPayload = readTenantIdFromUnknown(payload.tenantId);
        const principalIdFromPayload = readPrincipalIdFromUnknown(
          payload.principalId,
        );
        if (tenantIdFromPayload) {
          options.activeAzureTenantIdRef.current = tenantIdFromPayload;
        }
        if (principalIdFromPayload) {
          options.activeAzurePrincipalIdRef.current = principalIdFromPayload;
        }
        const parsedPrincipal = readAzurePrincipalProfileFromUnknown(
          payload.principal,
          options.activeAzureTenantIdRef.current,
          options.activeAzurePrincipalIdRef.current,
        );
        if (parsedPrincipal) {
          patchState({
            activeAzurePrincipal: parsedPrincipal,
          });
        } else if (
          options.activeAzureTenantIdRef.current &&
          options.activeAzurePrincipalIdRef.current
        ) {
          patchState({
            activeAzurePrincipal: {
              tenantId: options.activeAzureTenantIdRef.current,
              principalId: options.activeAzurePrincipalIdRef.current,
              displayName: options.activeAzurePrincipalIdRef.current,
              principalName: "",
              principalType: "unknown",
            },
          });
        }
        dispatch({
          type: "deployment_cache/upsert",
          tenantId: options.activeAzureTenantIdRef.current,
          projectId: normalizedProjectId,
          deployments: parsedDeployments,
        });
        applyDeployments(parsedDeployments);
      } catch (loadError) {
        const activeRequestSeq =
          target === "playground"
            ? playgroundAzureDeploymentRequestSeqRef.current
            : utilityAzureDeploymentRequestSeqRef.current;
        if (requestSeq !== activeRequestSeq) {
          return;
        }

        options.logClientError("load_azure_deployments_failed", loadError, {
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
          options.clearWorkspaceMcpServerProfilesState();
          options.clearThreadsState(
            "Azure login is required. Open Settings and sign in to load threads.",
          );
        }

        patchState(
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
            ? playgroundAzureDeploymentRequestSeqRef.current
            : utilityAzureDeploymentRequestSeqRef.current;
        if (requestSeq === activeRequestSeq) {
          patchState(
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
    },
  );

  const runAzureLoginFlow = useEffectEvent(
    async (targetTenantIdRaw = ""): Promise<LoadAzureProjectsResult> => {
      const targetTenantId = targetTenantIdRaw.trim();
      const waitForWorkspaceStateReload = targetTenantId.length > 0;
      const payload = await azureSessionApiClient.startSession(targetTenantId);
      options.setSystemNotice(
        targetTenantId
          ? "Azure tenant switched. Azure projects were refreshed."
          : payload.message || "Azure login completed.",
      );

      patchState({
        isAzureAuthRequired: resolveAzureAuthRequiredState({
          currentAuthRequired: stateRef.current.isAzureAuthRequired,
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
        patchState({
          isAzureAuthRequired: true,
        });
      }

      patchState({
        azureLoginError: null,
      });

      return {
        ...loadResult,
        message: payload.message,
      } as LoadAzureProjectsResult;
    },
  );

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = state.theme;
    }
  }, [state.theme]);

  useEffect(() => {
    options.selectedPlaygroundAzureConnectionIdRef.current =
      state.selectedPlaygroundAzureConnectionId;
  }, [options.selectedPlaygroundAzureConnectionIdRef, state.selectedPlaygroundAzureConnectionId]);

  useEffect(() => {
    options.selectedPlaygroundAzureDeploymentNameRef.current =
      state.selectedPlaygroundAzureDeploymentName;
  }, [options.selectedPlaygroundAzureDeploymentNameRef, state.selectedPlaygroundAzureDeploymentName]);

  useEffect(() => {
    options.selectedUtilityAzureConnectionIdRef.current =
      state.selectedUtilityAzureConnectionId;
  }, [options.selectedUtilityAzureConnectionIdRef, state.selectedUtilityAzureConnectionId]);

  useEffect(() => {
    options.selectedUtilityAzureDeploymentNameRef.current =
      state.selectedUtilityAzureDeploymentName;
  }, [options.selectedUtilityAzureDeploymentNameRef, state.selectedUtilityAzureDeploymentName]);

  useEffect(() => {
    void loadAzureProjects();
  }, []);

  useEffect(() => {
    if (!state.isAzureAuthRequired) {
      return;
    }

    const refreshConnections = () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        return;
      }

      void (async () => {
        const loadResult = await loadAzureProjects();
        if (isAzureProjectsLoadReady(loadResult)) {
          patchState({
            azureLoginError: null,
          });
        }
      })();
    };

    const intervalId = window.setInterval(refreshConnections, 4000);
    window.addEventListener("focus", refreshConnections);
    document.addEventListener("visibilitychange", refreshConnections);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshConnections);
      document.removeEventListener("visibilitychange", refreshConnections);
    };
  }, [state.isAzureAuthRequired]);

  useEffect(() => {
    if (!activePlaygroundAzureConnection) {
      cancelAzureDeploymentLoad("playground");
      patchState({
        playgroundAzureDeployments: [],
        selectedPlaygroundAzureDeploymentName: "",
        playgroundAzureDeploymentError: null,
      });
      return;
    }

    void loadAzureDeployments(activePlaygroundAzureConnection.id, "playground", {
      force: true,
    });
  }, [activePlaygroundAzureConnection]);

  useEffect(() => {
    if (!activeUtilityAzureConnection) {
      cancelAzureDeploymentLoad("utility");
      patchState({
        utilityAzureDeployments: [],
        selectedUtilityAzureDeploymentName: "",
        utilityAzureDeploymentError: null,
      });
      return;
    }

    void loadAzureDeployments(activeUtilityAzureConnection.id, "utility", {
      force: true,
    });
  }, [activeUtilityAzureConnection]);

  useEffect(() => {
    if (state.isAzureAuthRequired) {
      return;
    }

    const tenantId = options.activeAzureTenantIdRef.current.trim();
    const principalId = options.activeAzurePrincipalIdRef.current.trim();
    const projectId = state.selectedPlaygroundAzureConnectionId.trim();
    const deploymentName = state.selectedPlaygroundAzureDeploymentName.trim();
    if (!tenantId || !principalId || !projectId || !deploymentName) {
      return;
    }
    if (!state.azureConnections.some((connection) => connection.id === projectId)) {
      return;
    }
    if (!includesAzureDeploymentName(state.playgroundAzureDeployments, deploymentName)) {
      return;
    }

    const preferred = preferredAzureSelectionRef.current;
    if (
      preferred &&
      preferred.tenantId === tenantId &&
      preferred.principalId === principalId &&
      preferred.playground?.projectId === projectId &&
      preferred.playground?.deploymentName === deploymentName
    ) {
      return;
    }

    void saveAzureSelectionPreference({
      target: "playground",
      tenantId,
      principalId,
      projectId,
      deploymentName,
    });
  }, [
    state.azureConnections,
    state.isAzureAuthRequired,
    state.playgroundAzureDeployments,
    state.selectedPlaygroundAzureConnectionId,
    state.selectedPlaygroundAzureDeploymentName,
  ]);

  useEffect(() => {
    if (state.isAzureAuthRequired) {
      return;
    }

    const tenantId = options.activeAzureTenantIdRef.current.trim();
    const principalId = options.activeAzurePrincipalIdRef.current.trim();
    const projectId = state.selectedUtilityAzureConnectionId.trim();
    const deploymentName = state.selectedUtilityAzureDeploymentName.trim();
    if (!tenantId || !principalId || !projectId || !deploymentName) {
      return;
    }
    if (!state.azureConnections.some((connection) => connection.id === projectId)) {
      return;
    }
    if (!includesAzureDeploymentName(state.utilityAzureDeployments, deploymentName)) {
      return;
    }

    const preferred = preferredAzureSelectionRef.current;
    if (
      preferred &&
      preferred.tenantId === tenantId &&
      preferred.principalId === principalId &&
      preferred.utility?.projectId === projectId &&
      preferred.utility?.deploymentName === deploymentName &&
      preferred.utility?.reasoningEffort === effectiveUtilityReasoningEffort
    ) {
      return;
    }

    void saveAzureSelectionPreference({
      target: "utility",
      tenantId,
      principalId,
      projectId,
      deploymentName,
      reasoningEffort: effectiveUtilityReasoningEffort,
    });
  }, [
    effectiveUtilityReasoningEffort,
    state.azureConnections,
    state.isAzureAuthRequired,
    state.selectedUtilityAzureConnectionId,
    state.selectedUtilityAzureDeploymentName,
    state.utilityAzureDeployments,
  ]);

  useEffect(() => {
    return () => {
      clearWorkspaceMcpServerProfileLoginRetryTimeout();
    };
  }, []);

  return {
    theme: state.theme,
    azureConnections: state.azureConnections,
    azureTenants: state.azureTenants,
    playgroundAzureDeployments: state.playgroundAzureDeployments,
    utilityAzureDeployments: state.utilityAzureDeployments,
    playgroundAzureDeploymentNames,
    utilityAzureDeploymentNames,
    activeAzurePrincipal: state.activeAzurePrincipal,
    activePlaygroundAzureConnection,
    activeUtilityAzureConnection,
    selectedPlaygroundAzureConnectionId: state.selectedPlaygroundAzureConnectionId,
    selectedPlaygroundAzureDeploymentName: state.selectedPlaygroundAzureDeploymentName,
    selectedUtilityAzureConnectionId: state.selectedUtilityAzureConnectionId,
    selectedUtilityAzureDeploymentName: state.selectedUtilityAzureDeploymentName,
    isLoadingAzureConnections: state.isLoadingAzureConnections,
    isLoadingPlaygroundAzureDeployments:
      state.isLoadingPlaygroundAzureDeployments,
    isLoadingUtilityAzureDeployments: state.isLoadingUtilityAzureDeployments,
    azureConnectionError: state.azureConnectionError,
    playgroundAzureDeploymentError: state.playgroundAzureDeploymentError,
    utilityAzureDeploymentError: state.utilityAzureDeploymentError,
    isAzureAuthRequired: state.isAzureAuthRequired,
    utilityReasoningEffort: state.utilityReasoningEffort,
    isStartingAzureLogin: state.isStartingAzureLogin,
    isSwitchingAzureTenant: state.isSwitchingAzureTenant,
    isStartingAzureLogout: state.isStartingAzureLogout,
    isReloadingAzureCatalog: state.isReloadingAzureCatalog,
    azureLoginError: state.azureLoginError,
    azureTenantSwitchError: state.azureTenantSwitchError,
    azureLogoutError: state.azureLogoutError,
    effectiveUtilityReasoningEffortOptions,
    effectiveUtilityReasoningEffort,
    isUtilityReasoningEffortSupported,
    handleThemeChange(nextTheme) {
      patchState({
        theme: nextTheme,
      });
      void saveThemePreference(nextTheme);
    },
    clearAzureSessionStatus() {
      patchState({
        azureLoginError: null,
        azureTenantSwitchError: null,
        azureLogoutError: null,
      });
    },
    markAzureAuthRequired() {
      patchState({
        isAzureAuthRequired: true,
      });
    },
    resolveAzureBackgroundSuccess() {
      patchState({
        isAzureAuthRequired: resolveAzureAuthRequiredState({
          currentAuthRequired: stateRef.current.isAzureAuthRequired,
          nextAuthRequired: false,
          source: "background_success",
        }),
      });
    },
    reportAzureTenantSwitchPending() {
      patchState({
        azureTenantSwitchError:
          "Azure tenant switch is still applying. Retry Azure Login if this persists.",
      });
    },
    async handleAzureLogin() {
      if (stateRef.current.isStartingAzureLogin || stateRef.current.isSwitchingAzureTenant) {
        return;
      }

      options.setSystemNotice(null);
      patchState({
        azureLoginError: null,
        azureTenantSwitchError: null,
        isStartingAzureLogin: true,
      });
      try {
        await runAzureLoginFlow();
      } catch (loginError) {
        options.logClientError("azure_login_flow_failed", loginError, {
          action: "azure_login",
        });
        patchState({
          azureLoginError:
            loginError instanceof Error
              ? loginError.message
              : "Failed to start Azure login.",
        });
      } finally {
        patchState({
          isStartingAzureLogin: false,
        });
      }
    },
    async handleAzureTenantChange(nextTenantIdRaw: string) {
      const currentState = stateRef.current;
      if (
        currentState.isAzureAuthRequired ||
        currentState.isStartingAzureLogin ||
        currentState.isSwitchingAzureTenant ||
        currentState.isStartingAzureLogout
      ) {
        return;
      }

      const nextTenantId = nextTenantIdRaw.trim();
      const activeTenantId = options.activeAzureTenantIdRef.current.trim();
      if (!nextTenantId || nextTenantId === activeTenantId) {
        return;
      }

      options.setSystemNotice(null);
      patchState({
        azureTenantSwitchError: null,
        azureLoginError: null,
        isSwitchingAzureTenant: true,
      });
      try {
        const loadResult = await runAzureLoginFlow(nextTenantId);
        if (loadResult.tenantSwitchPending) {
          patchState({
            azureTenantSwitchError:
              "Azure tenant switch is still applying. Retry Azure Login if this persists.",
          });
        } else if (loadResult.authRequired) {
          patchState({
            azureTenantSwitchError:
              "Failed to switch Azure tenant. Retry Azure Login.",
          });
        }
      } catch (switchError) {
        options.logClientError("azure_tenant_switch_failed", switchError, {
          action: "azure_tenant_switch",
          context: {
            tenantId: nextTenantId,
          },
        });
        patchState({
          azureTenantSwitchError:
            switchError instanceof Error
              ? switchError.message
              : "Failed to switch Azure tenant.",
        });
      } finally {
        patchState({
          isSwitchingAzureTenant: false,
        });
      }
    },
    async handleAzureLogout() {
      const currentState = stateRef.current;
      if (currentState.isStartingAzureLogout || currentState.isSwitchingAzureTenant) {
        return;
      }

      options.setSystemNotice(null);
      patchState({
        azureLogoutError: null,
        azureTenantSwitchError: null,
        isStartingAzureLogout: true,
      });
      try {
        const payload = await azureSessionApiClient.endSession();
        patchState({
          playgroundAzureDeploymentError: null,
          utilityAzureDeploymentError: null,
        });
        await loadAzureProjects({ force: true });
        options.setSystemNotice(payload.message || "Azure logout completed.");
      } catch (logoutError) {
        options.logClientError("azure_logout_flow_failed", logoutError, {
          action: "azure_logout",
        });
        patchState({
          azureLogoutError:
            logoutError instanceof Error
              ? logoutError.message
              : "Failed to run Azure logout.",
        });
      } finally {
        patchState({
          isStartingAzureLogout: false,
        });
      }
    },
    async handleReloadAzureCatalog() {
      const currentState = stateRef.current;
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

      options.setSystemNotice(null);
      patchState({
        azureConnectionError: null,
        playgroundAzureDeploymentError: null,
        utilityAzureDeploymentError: null,
        azureTenantSwitchError: null,
        azureLoginError: null,
        isReloadingAzureCatalog: true,
      });

      try {
        dispatch({
          type: "cache/clear_tenant",
          tenantId: options.activeAzureTenantIdRef.current,
        });
        const loadResult = await loadAzureProjects({ force: true });
        if (isAzureProjectsLoadReady(loadResult)) {
          options.setSystemNotice("Azure catalog reloaded.");
        }
      } finally {
        patchState({
          isReloadingAzureCatalog: false,
        });
      }
    },
    handleSelectPlaygroundProject(projectId) {
      patchState({
        selectedPlaygroundAzureConnectionId: projectId,
        selectedPlaygroundAzureDeploymentName: "",
        playgroundAzureDeploymentError: null,
      });
    },
    handleSelectPlaygroundDeployment(deploymentName) {
      patchState({
        selectedPlaygroundAzureDeploymentName: deploymentName.trim(),
      });
    },
    handleSelectUtilityProject(projectId) {
      patchState({
        selectedUtilityAzureConnectionId: projectId,
        selectedUtilityAzureDeploymentName: "",
        utilityAzureDeploymentError: null,
      });
    },
    handleSelectUtilityDeployment(deploymentName) {
      patchState({
        selectedUtilityAzureDeploymentName: deploymentName.trim(),
      });
    },
    handleUtilityReasoningEffortChange(value) {
      patchState({
        utilityReasoningEffort: value,
      });
    },
    loadAzureProjects,
  };
}
