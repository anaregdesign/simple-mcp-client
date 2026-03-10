import type {
  Dispatch,
  MutableRefObject,
} from "react";
import type {
  AzureDeploymentOption,
  AzurePrincipalProfile,
  AzureProjectOption,
  AzureSelectionPreference,
  AzureTenantOption,
} from "./parsers";
import type { AzureProjectsLoadResult } from "./catalog-state";
import type { AzureSettingsAction } from "./reducer";
import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";
import type { ThemeMode } from "~/lib/domain/value-objects/theme-mode";

export type AzureProjectCatalogCacheEntry = {
  tenantId: string;
  principalId: string;
  principal: AzurePrincipalProfile | null;
  tenants: AzureTenantOption[];
  projects: AzureProjectOption[];
};

export type AzureProjectCatalogCacheByTenantId = Record<
  string,
  AzureProjectCatalogCacheEntry
>;

export type AzureDeploymentCatalogCacheByTenantProjectKey = Record<
  string,
  AzureDeploymentOption[]
>;

export type LoadAzureProjectsOptions = {
  force?: boolean;
  preferredTenantId?: string;
  waitForWorkspaceStateReload?: boolean;
};

export type LoadAzureProjectsResult = AzureProjectsLoadResult;

export type AzureSettingsState = {
  theme: ThemeMode;
  azureConnections: AzureProjectOption[];
  azureTenants: AzureTenantOption[];
  playgroundAzureDeployments: AzureDeploymentOption[];
  utilityAzureDeployments: AzureDeploymentOption[];
  activeAzurePrincipal: AzurePrincipalProfile | null;
  selectedPlaygroundAzureConnectionId: string;
  selectedPlaygroundAzureDeploymentName: string;
  selectedUtilityAzureConnectionId: string;
  selectedUtilityAzureDeploymentName: string;
  isLoadingAzureConnections: boolean;
  isLoadingPlaygroundAzureDeployments: boolean;
  isLoadingUtilityAzureDeployments: boolean;
  azureProjectCatalogCacheByTenantId: AzureProjectCatalogCacheByTenantId;
  azureDeploymentCatalogCacheByTenantProjectKey: AzureDeploymentCatalogCacheByTenantProjectKey;
  azureConnectionError: string | null;
  playgroundAzureDeploymentError: string | null;
  utilityAzureDeploymentError: string | null;
  isAzureAuthRequired: boolean;
  utilityReasoningEffort: ReasoningEffort;
  isStartingAzureLogin: boolean;
  isSwitchingAzureTenant: boolean;
  isStartingAzureLogout: boolean;
  isReloadingAzureCatalog: boolean;
  azureLoginError: string | null;
  azureTenantSwitchError: string | null;
  azureLogoutError: string | null;
};

export type AzureLogOptions = {
  category?: string;
  location?: string;
  action?: string;
  statusCode?: number;
  context?: Record<string, unknown>;
};

export type UseAzureSettingsOptions = {
  isSending: boolean;
  readIsThreadsReady: () => boolean;
  readIsLoadingThreads: () => boolean;
  setSystemNotice: (message: string | null) => void;
  readActiveAzureTenantId: () => string;
  writeActiveAzureTenantId: (value: string) => void;
  readActiveAzurePrincipalId: () => string;
  writeActiveAzurePrincipalId: (value: string) => void;
  readActiveWorkspaceUserKey: () => string;
  writeActiveWorkspaceUserKey: (value: string) => void;
  readSelectedPlaygroundAzureConnectionId: () => string;
  writeSelectedPlaygroundAzureConnectionId: (value: string) => void;
  writeSelectedPlaygroundAzureDeploymentName: (value: string) => void;
  readSelectedUtilityAzureConnectionId: () => string;
  writeSelectedUtilityAzureConnectionId: (value: string) => void;
  writeSelectedUtilityAzureDeploymentName: (value: string) => void;
  clearWorkspaceMcpServerProfilesState: (nextError?: string | null) => void;
  loadWorkspaceMcpServerProfiles: () => Promise<void>;
  clearThreadsState: (nextError?: string | null) => void;
  showThreadReloadPlaceholder: () => void;
  loadThreads: () => Promise<void>;
  logClientError: (
    eventName: string,
    error: unknown,
    options?: AzureLogOptions,
  ) => void;
  logClientWarning: (
    eventName: string,
    message: string,
    options?: Omit<AzureLogOptions, "statusCode">,
  ) => void;
};

export type AzureSettingsController = {
  theme: ThemeMode;
  azureConnections: AzureProjectOption[];
  azureTenants: AzureTenantOption[];
  playgroundAzureDeployments: AzureDeploymentOption[];
  utilityAzureDeployments: AzureDeploymentOption[];
  playgroundAzureDeploymentNames: string[];
  utilityAzureDeploymentNames: string[];
  activeAzurePrincipal: AzurePrincipalProfile | null;
  activePlaygroundAzureConnection: AzureProjectOption | null;
  activeUtilityAzureConnection: AzureProjectOption | null;
  selectedPlaygroundAzureConnectionId: string;
  selectedPlaygroundAzureDeploymentName: string;
  selectedUtilityAzureConnectionId: string;
  selectedUtilityAzureDeploymentName: string;
  isLoadingAzureConnections: boolean;
  isLoadingPlaygroundAzureDeployments: boolean;
  isLoadingUtilityAzureDeployments: boolean;
  azureConnectionError: string | null;
  playgroundAzureDeploymentError: string | null;
  utilityAzureDeploymentError: string | null;
  isAzureAuthRequired: boolean;
  utilityReasoningEffort: ReasoningEffort;
  isStartingAzureLogin: boolean;
  isSwitchingAzureTenant: boolean;
  isStartingAzureLogout: boolean;
  isReloadingAzureCatalog: boolean;
  azureLoginError: string | null;
  azureTenantSwitchError: string | null;
  azureLogoutError: string | null;
  effectiveUtilityReasoningEffortOptions: ReasoningEffort[];
  effectiveUtilityReasoningEffort: ReasoningEffort;
  isUtilityReasoningEffortSupported: boolean;
  clearAzureSessionStatus: () => void;
  markAzureAuthRequired: () => void;
  resolveAzureBackgroundSuccess: () => void;
  reportAzureTenantSwitchPending: () => void;
  handleThemeChange: (nextTheme: ThemeMode) => void;
  handleAzureLogin: () => Promise<void>;
  handleAzureTenantChange: (nextTenantId: string) => Promise<void>;
  handleAzureLogout: () => Promise<void>;
  handleReloadAzureCatalog: () => Promise<void>;
  handleSelectPlaygroundProject: (projectId: string) => void;
  handleSelectPlaygroundDeployment: (deploymentName: string) => void;
  handleSelectUtilityProject: (projectId: string) => void;
  handleSelectUtilityDeployment: (deploymentName: string) => void;
  handleUtilityReasoningEffortChange: (value: ReasoningEffort) => void;
  loadAzureProjects: (
    options?: LoadAzureProjectsOptions,
  ) => Promise<LoadAzureProjectsResult>;
};

export type AzureSelectionSaveInput =
  | {
      target: "playground";
      tenantId: string;
      principalId: string;
      projectId: string;
      deploymentName: string;
    }
  | {
      target: "utility";
      tenantId: string;
      principalId: string;
      projectId: string;
      deploymentName: string;
      reasoningEffort: ReasoningEffort;
    };

export type AzureSettingsStatePatch = Partial<AzureSettingsState>;

export type AzureCacheRefs = {
  preferredAzureSelectionRef: MutableRefObject<AzureSelectionPreference | null>;
};

export type AzureDeploymentTarget = "playground" | "utility";

export type AzureLoadAzureDeploymentsOptions = {
  force?: boolean;
};

export type AzureSettingsHandlerDependencies = {
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
    options?: AzureLoadAzureDeploymentsOptions,
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
