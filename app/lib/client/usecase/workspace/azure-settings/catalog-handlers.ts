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
  ClientApiError,
  mapApiError,
} from "~/lib/client/infrastructure/api/api-client";
import {
  shouldScheduleWorkspaceMcpServerProfileLoginRetry,
} from "~/lib/client/usecase/workspace/mcp-profiles/selectors";
import {
  isLikelyChatAzureAuthError,
} from "./errors";
import {
  readAzureDeploymentList,
  readAzurePrincipalProfileFromUnknown,
  readAzureProjectList,
  readAzureSelectionFromUnknown,
  readAzureTenantList,
  readPrincipalIdFromUnknown,
  readTenantIdFromUnknown,
  type AzureSelectionPreference,
} from "./parsers";
import {
  selectCachedAzureDeployments,
  selectCachedAzureProjectCatalog,
} from "./selectors";
import {
  buildAzureProjectsLoadResult,
  resolveAzureAuthRequiredState,
  resolveAzureTenantOptions,
  resolveInitialAzureProjectId,
  shouldUseCachedAzureProjectCatalog,
} from "./catalog-state";
import type {
  AzureDeploymentTarget,
  AzureLoadAzureDeploymentsOptions,
  AzureSelectionSaveInput,
  AzureSettingsHandlerDependencies,
  AzureSettingsHandlers,
  AzureSettingsState,
  LoadAzureProjectsOptions,
  LoadAzureProjectsResult,
} from "./types";

export type AzureCatalogHandlers = Pick<
  AzureSettingsHandlers,
  | "cancelAzureDeploymentLoad"
  | "clearWorkspaceMcpServerProfileLoginRetryTimeout"
  | "saveAzureSelectionPreference"
  | "saveThemePreference"
  | "loadAzureProjects"
  | "loadAzureDeployments"
>;

function clearWorkspaceMcpServerProfileLoginRetryTimeout(
  deps: AzureSettingsHandlerDependencies,
) {
  deps.clearWorkspaceMcpServerProfileLoginRetryTimeout();
}

function cancelAzureDeploymentLoad(
  deps: AzureSettingsHandlerDependencies,
  target: AzureDeploymentTarget,
): void {
  deps.nextAzureDeploymentRequestSeq(target);
  if (target === "playground") {
    deps.patchState({
      isLoadingPlaygroundAzureDeployments: false,
    });
    return;
  }

  deps.patchState({
    isLoadingUtilityAzureDeployments: false,
  });
}

function cancelAzureDeploymentLoads(
  deps: AzureSettingsHandlerDependencies,
): void {
  cancelAzureDeploymentLoad(deps, "playground");
  cancelAzureDeploymentLoad(deps, "utility");
}

function clearActiveAzureIdentity(
  deps: AzureSettingsHandlerDependencies,
): void {
  deps.options.writeActiveAzureTenantId("");
  deps.options.writeActiveAzurePrincipalId("");
  deps.options.writeActiveWorkspaceUserKey("");
  deps.writePreferredAzureSelection(null);
  cancelAzureDeploymentLoads(deps);
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
  deps: AzureSettingsHandlerDependencies,
  tenantId: string,
  principalId: string,
): string {
  deps.options.writeActiveAzureTenantId(tenantId);
  deps.options.writeActiveAzurePrincipalId(principalId);
  const nextWorkspaceUserKey =
    tenantId && principalId ? `${tenantId}::${principalId}` : "";
  deps.options.writeActiveWorkspaceUserKey(nextWorkspaceUserKey);
  return nextWorkspaceUserKey;
}

async function reloadWorkspaceStateForActiveIdentity(
  deps: AzureSettingsHandlerDependencies,
  waitForWorkspaceStateReload: boolean,
): Promise<void> {
  deps.options.clearWorkspaceMcpServerProfilesState();
  deps.options.clearThreadsState();

  const nextWorkspaceUserKey =
    deps.options.readActiveWorkspaceUserKey().trim();
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

function scheduleWorkspaceMcpServerProfileLoginRetry(
  deps: AzureSettingsHandlerDependencies,
  expectedUserKey: string,
) {
  deps.scheduleWorkspaceMcpServerProfileLoginRetryTimeout(() => {
    if (deps.options.readActiveWorkspaceUserKey() === expectedUserKey) {
      void deps.options.loadWorkspaceMcpServerProfiles();
    }
  });
}

async function syncWorkspaceStateForLoadedIdentity(
  deps: AzureSettingsHandlerDependencies,
  options: {
    currentAuthRequired: boolean;
    previousWorkspaceUserKey: string;
    nextWorkspaceUserKey: string;
    waitForWorkspaceStateReload: boolean;
  },
) {
  if (!options.nextWorkspaceUserKey) {
    deps.options.clearWorkspaceMcpServerProfilesState();
    deps.options.clearThreadsState();
  } else if (
    options.previousWorkspaceUserKey !== options.nextWorkspaceUserKey
  ) {
    await reloadWorkspaceStateForActiveIdentity(
      deps,
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
    scheduleWorkspaceMcpServerProfileLoginRetry(
      deps,
      options.nextWorkspaceUserKey,
    );
  } else {
    clearWorkspaceMcpServerProfileLoginRetryTimeout(deps);
  }
}

async function loadAzureSelectionPreference(
  deps: AzureSettingsHandlerDependencies,
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
  deps: AzureSettingsHandlerDependencies,
  selection: AzureSelectionSaveInput,
): Promise<void> {
  const currentPreferredSelection = deps.readPreferredAzureSelection();
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
  deps.writePreferredAzureSelection(nextPreferredSelection);
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
  deps: AzureSettingsHandlerDependencies,
  nextTheme: AzureSettingsState["theme"],
): Promise<void> {
  const tenantId = deps.options.readActiveAzureTenantId().trim();
  const principalId = deps.options.readActiveAzurePrincipalId().trim();
  if (!tenantId || !principalId) {
    return;
  }

  const currentPreferredSelection = deps.readPreferredAzureSelection();
  deps.writePreferredAzureSelection(
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
        },
  );

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

function resolveProjectSelection(
  deps: AzureSettingsHandlerDependencies,
  options: {
    projects: Array<{ id: string }>;
    preferredSelection: AzureSelectionPreference | null;
  },
) {
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
    currentProjectId: deps.options.readSelectedPlaygroundAzureConnectionId(),
    preferredProjectId: preferredPlaygroundProjectId,
    defaultProjectId,
  });
  const nextUtilityProjectId = resolveInitialAzureProjectId({
    knownProjectIds,
    currentProjectId: deps.options.readSelectedUtilityAzureConnectionId(),
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

function applyAzureDeployments(
  deps: AzureSettingsHandlerDependencies,
  target: AzureDeploymentTarget,
  normalizedProjectId: string,
  deployments: AzureSettingsState["playgroundAzureDeployments"],
) {
  const preferredSelection = deps.readPreferredAzureSelection();
  const preferredDeploymentName =
    preferredSelection &&
    preferredSelection.tenantId === deps.options.readActiveAzureTenantId() &&
    preferredSelection.principalId ===
      deps.options.readActiveAzurePrincipalId() &&
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

async function loadAzureProjects(
  deps: AzureSettingsHandlerDependencies,
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
  const requestSeq = deps.nextAzureConnectionsRequestSeq();
  deps.patchState({
    isLoadingAzureConnections: true,
  });

  try {
    if (useCachedProjectCatalog) {
      const tenantIdForCache =
        preferredTenantId || deps.options.readActiveAzureTenantId().trim();
      const cachedCatalog = selectCachedAzureProjectCatalog(
        deps.readState(),
        tenantIdForCache,
      );
      if (cachedCatalog) {
        const previousWorkspaceUserKey =
          deps.options.readActiveWorkspaceUserKey();
        const nextWorkspaceUserKey = updateActiveAzureIdentity(
          deps,
          cachedCatalog.tenantId,
          cachedCatalog.principalId,
        );
        await syncWorkspaceStateForLoadedIdentity(deps, {
          currentAuthRequired: currentState.isAzureAuthRequired,
          previousWorkspaceUserKey,
          nextWorkspaceUserKey,
          waitForWorkspaceStateReload,
        });

        const preferredSelection =
          cachedCatalog.tenantId && cachedCatalog.principalId
            ? await loadAzureSelectionPreference(
                deps,
                cachedCatalog.tenantId,
                cachedCatalog.principalId,
              )
            : null;
        if (requestSeq !== deps.readAzureConnectionsRequestSeq()) {
          return {
            authRequired: false,
            tenantSwitchPending: false,
          };
        }

        deps.writePreferredAzureSelection(preferredSelection);
        const {
          nextPlaygroundProjectId,
          nextUtilityProjectId,
          preferredUtilityReasoningEffort,
        } = resolveProjectSelection(deps, {
          projects: cachedCatalog.projects,
          preferredSelection,
        });

        cancelAzureDeploymentLoads(deps);
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
    if (requestSeq !== deps.readAzureConnectionsRequestSeq()) {
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
      deps.options.readActiveWorkspaceUserKey();
    const nextWorkspaceUserKey = updateActiveAzureIdentity(
      deps,
      tenantId,
      principalId,
    );
    await syncWorkspaceStateForLoadedIdentity(deps, {
      currentAuthRequired: currentState.isAzureAuthRequired,
      previousWorkspaceUserKey,
      nextWorkspaceUserKey,
      waitForWorkspaceStateReload,
    });

    const preferredSelection =
      tenantId && principalId
        ? await loadAzureSelectionPreference(deps, tenantId, principalId)
        : null;
    if (requestSeq !== deps.readAzureConnectionsRequestSeq()) {
      return {
        authRequired: payload.authRequired === true,
        tenantSwitchPending: false,
      };
    }

    deps.writePreferredAzureSelection(preferredSelection);
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
    } = resolveProjectSelection(deps, {
      projects: parsedProjects,
      preferredSelection,
    });

    cancelAzureDeploymentLoads(deps);
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
    if (requestSeq !== deps.readAzureConnectionsRequestSeq()) {
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
    clearActiveAzureIdentity(deps);
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
    if (requestSeq === deps.readAzureConnectionsRequestSeq()) {
      deps.patchState({
        isLoadingAzureConnections: false,
      });
    }
  }
}

async function loadAzureDeployments(
  deps: AzureSettingsHandlerDependencies,
  projectId: string,
  target: AzureDeploymentTarget,
  loadOptions: AzureLoadAzureDeploymentsOptions = {},
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
      deps.options.readActiveAzureTenantId(),
      normalizedProjectId,
    );
    if (cachedDeployments) {
      applyAzureDeployments(
        deps,
        target,
        normalizedProjectId,
        cachedDeployments,
      );
      return;
    }
  }

  const requestSeq = deps.nextAzureDeploymentRequestSeq(target);
  if (target === "playground") {
    deps.patchState({
      isLoadingPlaygroundAzureDeployments: true,
      playgroundAzureDeploymentError: null,
    });
  } else {
    deps.patchState({
      isLoadingUtilityAzureDeployments: true,
      utilityAzureDeploymentError: null,
    });
  }

  try {
    const payload = await azureProjectsApiClient.loadDeployments(
      normalizedProjectId,
    );
    const activeRequestSeq = deps.readAzureDeploymentRequestSeq(target);
    if (requestSeq !== activeRequestSeq) {
      return;
    }

    const selectedProjectId =
      target === "playground"
        ? deps.options.readSelectedPlaygroundAzureConnectionId().trim()
        : deps.options.readSelectedUtilityAzureConnectionId().trim();
    if (!selectedProjectId || selectedProjectId !== normalizedProjectId) {
      return;
    }

    const parsedDeployments = readAzureDeploymentList(payload.deployments);
    const tenantIdFromPayload = readTenantIdFromUnknown(payload.tenantId);
    const principalIdFromPayload = readPrincipalIdFromUnknown(
      payload.principalId,
    );
    if (tenantIdFromPayload) {
      deps.options.writeActiveAzureTenantId(tenantIdFromPayload);
    }
    if (principalIdFromPayload) {
      deps.options.writeActiveAzurePrincipalId(principalIdFromPayload);
    }
    const parsedPrincipal = readAzurePrincipalProfileFromUnknown(
      payload.principal,
      deps.options.readActiveAzureTenantId(),
      deps.options.readActiveAzurePrincipalId(),
    );
    if (parsedPrincipal) {
      deps.patchState({
        activeAzurePrincipal: parsedPrincipal,
      });
    } else if (
      deps.options.readActiveAzureTenantId() &&
      deps.options.readActiveAzurePrincipalId()
    ) {
      deps.patchState({
        activeAzurePrincipal: {
          tenantId: deps.options.readActiveAzureTenantId(),
          principalId: deps.options.readActiveAzurePrincipalId(),
          displayName: deps.options.readActiveAzurePrincipalId(),
          principalName: "",
          principalType: "unknown",
        },
      });
    }
    deps.dispatch({
      type: "deployment_cache/upsert",
      tenantId: deps.options.readActiveAzureTenantId(),
      projectId: normalizedProjectId,
      deployments: parsedDeployments,
    });
    applyAzureDeployments(deps, target, normalizedProjectId, parsedDeployments);
  } catch (loadError) {
    const activeRequestSeq = deps.readAzureDeploymentRequestSeq(target);
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
    const errorMessage = mapApiError(
      loadError,
      "Failed to load Azure deployments.",
    );
    deps.patchState(
      target === "playground"
        ? {
            playgroundAzureDeployments: [],
            selectedPlaygroundAzureDeploymentName: "",
            playgroundAzureDeploymentError: errorMessage,
          }
        : {
            utilityAzureDeployments: [],
            selectedUtilityAzureDeploymentName: "",
            utilityAzureDeploymentError: errorMessage,
          },
    );
  } finally {
    const activeRequestSeq = deps.readAzureDeploymentRequestSeq(target);
    if (requestSeq === activeRequestSeq) {
      deps.patchState(
        target === "playground"
          ? { isLoadingPlaygroundAzureDeployments: false }
          : { isLoadingUtilityAzureDeployments: false },
      );
    }
  }
}

export function createAzureCatalogHandlers(
  deps: AzureSettingsHandlerDependencies,
): AzureCatalogHandlers {
  return {
    cancelAzureDeploymentLoad(target) {
      cancelAzureDeploymentLoad(deps, target);
    },
    clearWorkspaceMcpServerProfileLoginRetryTimeout() {
      clearWorkspaceMcpServerProfileLoginRetryTimeout(deps);
    },
    saveAzureSelectionPreference(selection) {
      return saveAzureSelectionPreference(deps, selection);
    },
    saveThemePreference(nextTheme) {
      return saveThemePreference(deps, nextTheme);
    },
    loadAzureProjects(loadOptions) {
      return loadAzureProjects(deps, loadOptions);
    },
    loadAzureDeployments(projectId, target, loadOptions) {
      return loadAzureDeployments(deps, projectId, target, loadOptions);
    },
  };
}
