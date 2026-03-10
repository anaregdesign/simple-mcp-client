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
import { isLikelyChatAzureAuthError } from "./errors";
import {
  readAzureDeploymentList,
  readAzurePrincipalProfileFromUnknown,
  readAzureProjectList,
  readAzureTenantList,
  readPrincipalIdFromUnknown,
  readTenantIdFromUnknown,
} from "./parsers";
import {
  selectCachedAzureDeployments,
  selectCachedAzureProjectCatalog,
} from "./selectors";
import {
  buildAzureProjectsLoadResult,
  resolveAzureAuthRequiredState,
  resolveAzureTenantOptions,
  shouldUseCachedAzureProjectCatalog,
} from "./catalog-state";
import type { AzureCatalogRuntime } from "./catalog-runtime";
import type {
  AzureDeploymentTarget,
  AzureLoadAzureDeploymentsOptions,
  AzureSettingsHandlerDependencies,
  AzureSettingsState,
  LoadAzureProjectsOptions,
  LoadAzureProjectsResult,
} from "./types";

type AzureCatalogOperations = {
  loadAzureProjects: (
    loadOptions?: LoadAzureProjectsOptions,
  ) => Promise<LoadAzureProjectsResult>;
  loadAzureDeployments: (
    projectId: string,
    target: AzureDeploymentTarget,
    loadOptions?: AzureLoadAzureDeploymentsOptions,
  ) => Promise<void>;
};

export function createAzureCatalogOperations(
  deps: AzureSettingsHandlerDependencies,
  runtime: Pick<
    AzureCatalogRuntime,
    | "cancelAzureDeploymentLoads"
    | "clearActiveAzureIdentity"
    | "loadAzureSelectionPreference"
    | "resolveProjectSelection"
    | "syncWorkspaceStateForLoadedIdentity"
    | "updateActiveAzureIdentity"
  >,
): AzureCatalogOperations {
  function applyAzureDeployments(
    target: AzureDeploymentTarget,
    normalizedProjectId: string,
    deployments: AzureSettingsState["playgroundAzureDeployments"],
  ) {
    const preferredSelection = deps.preferredAzureSelectionRef.current;
    const preferredDeploymentName =
      preferredSelection &&
      preferredSelection.tenantId ===
        deps.options.activeAzureTenantIdRef.current &&
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
          const nextWorkspaceUserKey = runtime.updateActiveAzureIdentity(
            cachedCatalog.tenantId,
            cachedCatalog.principalId,
          );
          await runtime.syncWorkspaceStateForLoadedIdentity({
            currentAuthRequired: currentState.isAzureAuthRequired,
            previousWorkspaceUserKey,
            nextWorkspaceUserKey,
            waitForWorkspaceStateReload,
          });

          const preferredSelection =
            cachedCatalog.tenantId && cachedCatalog.principalId
              ? await runtime.loadAzureSelectionPreference(
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
          } = runtime.resolveProjectSelection({
            projects: cachedCatalog.projects,
            preferredSelection,
          });

          runtime.cancelAzureDeploymentLoads();
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
      const nextWorkspaceUserKey = runtime.updateActiveAzureIdentity(
        tenantId,
        principalId,
      );
      await runtime.syncWorkspaceStateForLoadedIdentity({
        currentAuthRequired: currentState.isAzureAuthRequired,
        previousWorkspaceUserKey,
        nextWorkspaceUserKey,
        waitForWorkspaceStateReload,
      });

      const preferredSelection =
        tenantId && principalId
          ? await runtime.loadAzureSelectionPreference(tenantId, principalId)
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
      } = runtime.resolveProjectSelection({
        projects: parsedProjects,
        preferredSelection,
      });

      runtime.cancelAzureDeploymentLoads();
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
      runtime.clearActiveAzureIdentity();
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

  async function loadAzureDeployments(
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
        runtime.clearActiveAzureIdentity();
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

  return {
    loadAzureProjects,
    loadAzureDeployments,
  };
}
