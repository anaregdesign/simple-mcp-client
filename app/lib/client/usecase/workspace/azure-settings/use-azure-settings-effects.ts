import {
  useEffect,
  useEffectEvent,
} from "react";
import {
  applyBrowserTheme,
  installAzureConnectionRefreshLoop,
  isBrowserDocumentVisible,
} from "~/lib/client/infrastructure/browser/azure-settings";
import type {
  AzureProjectOption,
  AzureSelectionPreference,
} from "./parsers";
import {
  includesAzureDeploymentName,
} from "./selectors";
import {
  isAzureProjectsLoadReady,
} from "./catalog-state";
import type {
  AzureSelectionSaveInput,
  AzureSettingsState,
  LoadAzureProjectsOptions,
  LoadAzureProjectsResult,
} from "./types";

type UseAzureSettingsEffectsOptions = {
  state: AzureSettingsState;
  activePlaygroundAzureConnection: AzureProjectOption | null;
  activeUtilityAzureConnection: AzureProjectOption | null;
  effectiveUtilityReasoningEffort: AzureSettingsState["utilityReasoningEffort"];
  readPreferredAzureSelection: () => AzureSelectionPreference | null;
  readActiveAzureTenantId: () => string;
  readActiveAzurePrincipalId: () => string;
  writeSelectedPlaygroundAzureConnectionId: (value: string) => void;
  writeSelectedPlaygroundAzureDeploymentName: (value: string) => void;
  writeSelectedUtilityAzureConnectionId: (value: string) => void;
  writeSelectedUtilityAzureDeploymentName: (value: string) => void;
  patchState: (patch: Partial<AzureSettingsState>) => void;
  loadAzureProjects: (
    options?: LoadAzureProjectsOptions,
  ) => Promise<LoadAzureProjectsResult>;
  loadAzureDeployments: (
    projectId: string,
    target: "playground" | "utility",
    options?: {
      force?: boolean;
    },
  ) => Promise<void>;
  cancelAzureDeploymentLoad: (target: "playground" | "utility") => void;
  saveAzureSelectionPreference: (
    selection: AzureSelectionSaveInput,
  ) => Promise<void>;
  clearWorkspaceMcpServerProfileLoginRetryTimeout: () => void;
};

export function useAzureSettingsEffects(
  options: UseAzureSettingsEffectsOptions,
) {
  const loadInitialAzureProjects = useEffectEvent(() => {
    void options.loadAzureProjects();
  });
  const refreshAzureConnections = useEffectEvent(async () => {
    if (!isBrowserDocumentVisible()) {
      return;
    }

    const loadResult = await options.loadAzureProjects();
    if (isAzureProjectsLoadReady(loadResult)) {
      options.patchState({
        azureLoginError: null,
      });
    }
  });
  const refreshPlaygroundAzureDeployments = useEffectEvent(
    async (projectId: string) => {
      await options.loadAzureDeployments(projectId, "playground", {
        force: true,
      });
    },
  );
  const refreshUtilityAzureDeployments = useEffectEvent(
    async (projectId: string) => {
      await options.loadAzureDeployments(projectId, "utility", {
        force: true,
      });
    },
  );
  const persistAzureSelectionPreference = useEffectEvent(
    async (selection: AzureSelectionSaveInput) => {
      await options.saveAzureSelectionPreference(selection);
    },
  );

  useEffect(() => {
    applyBrowserTheme(options.state.theme);
  }, [options.state.theme]);

  useEffect(() => {
    options.writeSelectedPlaygroundAzureConnectionId(
      options.state.selectedPlaygroundAzureConnectionId,
    );
    options.writeSelectedPlaygroundAzureDeploymentName(
      options.state.selectedPlaygroundAzureDeploymentName,
    );
    options.writeSelectedUtilityAzureConnectionId(
      options.state.selectedUtilityAzureConnectionId,
    );
    options.writeSelectedUtilityAzureDeploymentName(
      options.state.selectedUtilityAzureDeploymentName,
    );
  }, [
    options.state.selectedPlaygroundAzureConnectionId,
    options.state.selectedPlaygroundAzureDeploymentName,
    options.state.selectedUtilityAzureConnectionId,
    options.state.selectedUtilityAzureDeploymentName,
    options.writeSelectedPlaygroundAzureConnectionId,
    options.writeSelectedPlaygroundAzureDeploymentName,
    options.writeSelectedUtilityAzureConnectionId,
    options.writeSelectedUtilityAzureDeploymentName,
  ]);

  useEffect(() => {
    loadInitialAzureProjects();
  }, []);

  useEffect(() => {
    if (!options.state.isAzureAuthRequired) {
      return;
    }

    return installAzureConnectionRefreshLoop(refreshAzureConnections);
  }, [options.state.isAzureAuthRequired]);

  useEffect(() => {
    if (!options.activePlaygroundAzureConnection) {
      options.cancelAzureDeploymentLoad("playground");
      options.patchState({
        playgroundAzureDeployments: [],
        selectedPlaygroundAzureDeploymentName: "",
        playgroundAzureDeploymentError: null,
      });
      return;
    }

    void refreshPlaygroundAzureDeployments(
      options.activePlaygroundAzureConnection.id,
    );
  }, [options.activePlaygroundAzureConnection]);

  useEffect(() => {
    if (!options.activeUtilityAzureConnection) {
      options.cancelAzureDeploymentLoad("utility");
      options.patchState({
        utilityAzureDeployments: [],
        selectedUtilityAzureDeploymentName: "",
        utilityAzureDeploymentError: null,
      });
      return;
    }

    void refreshUtilityAzureDeployments(options.activeUtilityAzureConnection.id);
  }, [options.activeUtilityAzureConnection]);

  useEffect(() => {
    if (options.state.isAzureAuthRequired) {
      return;
    }

    const tenantId = options.readActiveAzureTenantId().trim();
    const principalId = options.readActiveAzurePrincipalId().trim();
    const projectId = options.state.selectedPlaygroundAzureConnectionId.trim();
    const deploymentName =
      options.state.selectedPlaygroundAzureDeploymentName.trim();
    if (!tenantId || !principalId || !projectId || !deploymentName) {
      return;
    }
    if (
      !options.state.azureConnections.some((connection) => connection.id === projectId)
    ) {
      return;
    }
    if (
      !includesAzureDeploymentName(
        options.state.playgroundAzureDeployments,
        deploymentName,
      )
    ) {
      return;
    }

    const preferred = options.readPreferredAzureSelection();
    if (
      preferred &&
      preferred.tenantId === tenantId &&
      preferred.principalId === principalId &&
      preferred.playground?.projectId === projectId &&
      preferred.playground?.deploymentName === deploymentName
    ) {
      return;
    }

    void persistAzureSelectionPreference({
      target: "playground",
      tenantId,
      principalId,
      projectId,
      deploymentName,
    });
  }, [
    options.state.azureConnections,
    options.state.isAzureAuthRequired,
    options.state.playgroundAzureDeployments,
    options.state.selectedPlaygroundAzureConnectionId,
    options.state.selectedPlaygroundAzureDeploymentName,
  ]);

  useEffect(() => {
    if (options.state.isAzureAuthRequired) {
      return;
    }

    const tenantId = options.readActiveAzureTenantId().trim();
    const principalId = options.readActiveAzurePrincipalId().trim();
    const projectId = options.state.selectedUtilityAzureConnectionId.trim();
    const deploymentName =
      options.state.selectedUtilityAzureDeploymentName.trim();
    if (!tenantId || !principalId || !projectId || !deploymentName) {
      return;
    }
    if (
      !options.state.azureConnections.some((connection) => connection.id === projectId)
    ) {
      return;
    }
    if (
      !includesAzureDeploymentName(
        options.state.utilityAzureDeployments,
        deploymentName,
      )
    ) {
      return;
    }

    const preferred = options.readPreferredAzureSelection();
    if (
      preferred &&
      preferred.tenantId === tenantId &&
      preferred.principalId === principalId &&
      preferred.utility?.projectId === projectId &&
      preferred.utility?.deploymentName === deploymentName &&
      preferred.utility?.reasoningEffort ===
        options.effectiveUtilityReasoningEffort
    ) {
      return;
    }

    void persistAzureSelectionPreference({
      target: "utility",
      tenantId,
      principalId,
      projectId,
      deploymentName,
      reasoningEffort: options.effectiveUtilityReasoningEffort,
    });
  }, [
    options.effectiveUtilityReasoningEffort,
    options.state.azureConnections,
    options.state.isAzureAuthRequired,
    options.state.selectedUtilityAzureConnectionId,
    options.state.selectedUtilityAzureDeploymentName,
    options.state.utilityAzureDeployments,
  ]);

  useEffect(() => {
    return () => {
      options.clearWorkspaceMcpServerProfileLoginRetryTimeout();
    };
  }, []);
}
