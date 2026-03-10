import {
  useEffect,
  useEffectEvent,
  type MutableRefObject,
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
} from "./runtime";
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
  preferredAzureSelectionRef: MutableRefObject<AzureSelectionPreference | null>;
  activeAzureTenantIdRef: MutableRefObject<string>;
  activeAzurePrincipalIdRef: MutableRefObject<string>;
  selectedPlaygroundAzureConnectionIdRef: MutableRefObject<string>;
  selectedPlaygroundAzureDeploymentNameRef: MutableRefObject<string>;
  selectedUtilityAzureConnectionIdRef: MutableRefObject<string>;
  selectedUtilityAzureDeploymentNameRef: MutableRefObject<string>;
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
    options.selectedPlaygroundAzureConnectionIdRef.current =
      options.state.selectedPlaygroundAzureConnectionId;
    options.selectedPlaygroundAzureDeploymentNameRef.current =
      options.state.selectedPlaygroundAzureDeploymentName;
    options.selectedUtilityAzureConnectionIdRef.current =
      options.state.selectedUtilityAzureConnectionId;
    options.selectedUtilityAzureDeploymentNameRef.current =
      options.state.selectedUtilityAzureDeploymentName;
  }, [
    options.selectedPlaygroundAzureConnectionIdRef,
    options.selectedPlaygroundAzureDeploymentNameRef,
    options.selectedUtilityAzureConnectionIdRef,
    options.selectedUtilityAzureDeploymentNameRef,
    options.state.selectedPlaygroundAzureConnectionId,
    options.state.selectedPlaygroundAzureDeploymentName,
    options.state.selectedUtilityAzureConnectionId,
    options.state.selectedUtilityAzureDeploymentName,
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

    const tenantId = options.activeAzureTenantIdRef.current.trim();
    const principalId = options.activeAzurePrincipalIdRef.current.trim();
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

    const preferred = options.preferredAzureSelectionRef.current;
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

    const tenantId = options.activeAzureTenantIdRef.current.trim();
    const principalId = options.activeAzurePrincipalIdRef.current.trim();
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

    const preferred = options.preferredAzureSelectionRef.current;
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
