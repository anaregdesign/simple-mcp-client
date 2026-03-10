import {
  DEFAULT_UTILITY_REASONING_EFFORT,
} from "~/lib/constants/chat";
import {
  azureProjectsApiClient,
} from "~/lib/client/infrastructure/api/azure-projects-api-client";
import {
  ClientApiError,
  mapApiError,
} from "~/lib/client/infrastructure/api/api-client";
import {
  isLikelyChatAzureAuthError,
} from "./errors";
import {
  readAzureDeploymentList,
  readAzurePrincipalProfileFromUnknown,
  readAzureProjectList,
  readAzureTenantList,
  readPrincipalIdFromUnknown,
  readTenantIdFromUnknown,
} from "./parsers";
import {
  buildAzureProjectsLoadResult,
  resolveAzureAuthRequiredState,
  resolveAzureTenantOptions,
  shouldUseCachedAzureProjectCatalog,
} from "./catalog-state";
import {
  loadAzureSelectionPreference,
  resolveProjectSelection,
  saveAzureSelectionPreference,
  saveThemePreference,
} from "./catalog-preferences";
import {
  applyAzureDeployments,
  cancelAzureDeploymentLoad,
  cancelAzureDeploymentLoads,
} from "./deployment-selection";
import {
  clearActiveAzureIdentity,
  clearWorkspaceMcpServerProfileLoginRetry,
  syncWorkspaceStateForLoadedIdentity,
  updateActiveAzureIdentity,
} from "./catalog-identity";
import {
  selectCachedAzureDeployments,
  selectCachedAzureProjectCatalog,
} from "./selectors";
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

export type AzureCatalogLoadingHandlers = Pick<
  AzureSettingsHandlers,
  | "cancelAzureDeploymentLoad"
  | "clearWorkspaceMcpServerProfileLoginRetryTimeout"
  | "saveAzureSelectionPreference"
  | "saveThemePreference"
  | "loadAzureProjects"
  | "loadAzureDeployments"
>;

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
    clearActiveAzureIdentity(deps, () => cancelAzureDeploymentLoads(deps));
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

export function createAzureCatalogLoadingHandlers(
  deps: AzureSettingsHandlerDependencies,
): AzureCatalogLoadingHandlers {
  return {
    cancelAzureDeploymentLoad(target) {
      cancelAzureDeploymentLoad(deps, target);
    },
    clearWorkspaceMcpServerProfileLoginRetryTimeout() {
      clearWorkspaceMcpServerProfileLoginRetry(deps);
    },
    saveAzureSelectionPreference(selection: AzureSelectionSaveInput) {
      return saveAzureSelectionPreference(deps, selection);
    },
    saveThemePreference(nextTheme: AzureSettingsState["theme"]) {
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
