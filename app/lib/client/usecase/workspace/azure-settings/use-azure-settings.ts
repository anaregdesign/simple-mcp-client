import {
  useEffect,
  useReducer,
  useRef,
} from "react";
import {
  DEFAULT_UTILITY_REASONING_EFFORT,
} from "~/lib/constants/chat";
import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";
import {
  resolveAzureAuthRequiredState,
} from "./catalog-state";
import type {
  AzureSelectionPreference,
} from "./parsers";
import {
  azureSettingsReducer,
  createInitialAzureSettingsReducerState,
} from "./reducer";
import {
  filterReasoningEffortOptionsForDeploymentCompatibility,
  resolveEffectiveReasoningEffort,
  resolveSupportedReasoningEffortOptions,
  selectActiveAzureConnection,
} from "./selectors";
import {
  createAzureSettingsHandlers,
} from "./handlers";
import {
  useAzureSettingsEffects,
} from "./use-azure-settings-effects";
import type {
  AzureSettingsController,
  AzureSettingsState,
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

  const {
    cancelAzureDeploymentLoad,
    clearWorkspaceMcpServerProfileLoginRetryTimeout,
    saveAzureSelectionPreference,
    saveThemePreference,
    loadAzureProjects,
    loadAzureDeployments,
    handleAzureLogin,
    handleAzureTenantChange,
    handleAzureLogout,
    handleReloadAzureCatalog,
    handleSelectPlaygroundProject,
    handleSelectPlaygroundDeployment,
    handleSelectUtilityProject,
    handleSelectUtilityDeployment,
    handleUtilityReasoningEffortChange,
  } = createAzureSettingsHandlers({
    options,
    dispatch,
    patchState,
    readState: () => stateRef.current,
    preferredAzureSelectionRef,
    azureConnectionsRequestSeqRef,
    playgroundAzureDeploymentRequestSeqRef,
    utilityAzureDeploymentRequestSeqRef,
    workspaceMcpServerProfileLoginRetryTimeoutRef,
  });

  useAzureSettingsEffects({
    state,
    activePlaygroundAzureConnection,
    activeUtilityAzureConnection,
    effectiveUtilityReasoningEffort,
    preferredAzureSelectionRef,
    activeAzureTenantIdRef: options.activeAzureTenantIdRef,
    activeAzurePrincipalIdRef: options.activeAzurePrincipalIdRef,
    selectedPlaygroundAzureConnectionIdRef:
      options.selectedPlaygroundAzureConnectionIdRef,
    selectedPlaygroundAzureDeploymentNameRef:
      options.selectedPlaygroundAzureDeploymentNameRef,
    selectedUtilityAzureConnectionIdRef:
      options.selectedUtilityAzureConnectionIdRef,
    selectedUtilityAzureDeploymentNameRef:
      options.selectedUtilityAzureDeploymentNameRef,
    patchState,
    loadAzureProjects,
    loadAzureDeployments,
    cancelAzureDeploymentLoad,
    saveAzureSelectionPreference,
    clearWorkspaceMcpServerProfileLoginRetryTimeout,
  });

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
    handleAzureLogin,
    handleAzureTenantChange,
    handleAzureLogout,
    handleReloadAzureCatalog,
    handleSelectPlaygroundProject,
    handleSelectPlaygroundDeployment,
    handleSelectUtilityProject,
    handleSelectUtilityDeployment,
    handleUtilityReasoningEffortChange,
    loadAzureProjects,
  };
}
