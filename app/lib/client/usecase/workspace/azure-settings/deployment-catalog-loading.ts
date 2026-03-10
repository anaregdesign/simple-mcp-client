import {
  azureProjectsApiClient,
} from "~/lib/client/infrastructure/api/azure-projects-api-client";
import {
  mapApiError,
} from "~/lib/client/infrastructure/api/api-client";
import {
  applyAzureDeployments,
} from "./deployment-selection";
import {
  readAzureDeploymentList,
  readAzurePrincipalProfileFromUnknown,
  readPrincipalIdFromUnknown,
  readTenantIdFromUnknown,
} from "./parsers";
import {
  selectCachedAzureDeployments,
} from "./selectors";
import type {
  AzureDeploymentTarget,
  AzureLoadAzureDeploymentsOptions,
  AzureSettingsHandlerDependencies,
} from "./types";

export async function loadAzureDeployments(
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
