import {
  MCP_DEFAULT_AZURE_AUTH_SCOPE,
  MCP_DEFAULT_TIMEOUT_SECONDS,
  MCP_TIMEOUT_SECONDS_MAX,
  MCP_TIMEOUT_SECONDS_MIN,
} from "~/lib/constants/mcp";
import {
  describeInstructionLanguage,
} from "~/lib/client/usecase/workspace/instruction-editor/instruction-document";
import {
  buildMcpServersTabProps,
  buildSettingsTabProps,
  buildSkillsTabProps,
  buildThreadsTabProps,
} from "~/lib/client/usecase/workspace/config-panel/selectors";
import type { MainViewTab } from "~/lib/client/usecase/workspace/view-types";

type SettingsTabBuilderOptions = Parameters<typeof buildSettingsTabProps>[0];
type McpServersTabBuilderOptions = Parameters<typeof buildMcpServersTabProps>[0];
type ThreadsTabBuilderOptions = Parameters<typeof buildThreadsTabProps>[0];
type SkillsTabBuilderOptions = Parameters<typeof buildSkillsTabProps>[0];

type ValueSetter<T> = (value: T) => void;

type BuildWorkspaceConfigPanelPropsOptions = {
  activeMainTab: MainViewTab;
  setActiveMainTab: ValueSetter<MainViewTab>;
  isChatLocked: boolean;
  theme: SettingsTabBuilderOptions["theme"];
  handleThemeChange: SettingsTabBuilderOptions["onThemeChange"];
  isAzureAuthRequired: SettingsTabBuilderOptions["isAzureAuthRequired"];
  isSending: SettingsTabBuilderOptions["isSending"];
  isStartingAzureLogin: SettingsTabBuilderOptions["isStartingAzureLogin"];
  handleAzureLogin: SettingsTabBuilderOptions["onAzureLogin"];
  azureTenants: SettingsTabBuilderOptions["azureTenants"];
  activeAzureTenantId: SettingsTabBuilderOptions["activeAzureTenantId"];
  isSwitchingAzureTenant: SettingsTabBuilderOptions["isSwitchingAzureTenant"];
  handleAzureTenantChange: SettingsTabBuilderOptions["onAzureTenantChange"];
  isLoadingAzureConnections: SettingsTabBuilderOptions["isLoadingAzureConnections"];
  isLoadingPlaygroundAzureDeployments: boolean;
  isLoadingUtilityAzureDeployments: SettingsTabBuilderOptions["isLoadingUtilityAzureDeployments"];
  isReloadingAzureCatalog: SettingsTabBuilderOptions["isReloadingAzureCatalog"];
  handleReloadAzureCatalog: SettingsTabBuilderOptions["onAzureCatalogReload"];
  activePlaygroundAzureConnection: SettingsTabBuilderOptions["activeAzureConnection"];
  activeAzurePrincipal: SettingsTabBuilderOptions["activeAzurePrincipal"];
  selectedPlaygroundAzureDeploymentName: SettingsTabBuilderOptions["selectedPlaygroundAzureDeploymentName"];
  isStartingAzureLogout: SettingsTabBuilderOptions["isStartingAzureLogout"];
  handleAzureLogout: SettingsTabBuilderOptions["onAzureLogout"];
  azureTenantSwitchError: SettingsTabBuilderOptions["azureTenantSwitchError"];
  azureLogoutError: SettingsTabBuilderOptions["azureLogoutError"];
  azureConnectionError: SettingsTabBuilderOptions["azureConnectionError"];
  azureConnections: SettingsTabBuilderOptions["azureConnections"];
  selectedUtilityAzureConnectionId: SettingsTabBuilderOptions["selectedUtilityAzureConnectionId"];
  selectedUtilityAzureDeploymentName: SettingsTabBuilderOptions["selectedUtilityAzureDeploymentName"];
  utilityAzureDeploymentNames: SettingsTabBuilderOptions["utilityAzureDeployments"];
  effectiveUtilityReasoningEffort: SettingsTabBuilderOptions["utilityReasoningEffort"];
  effectiveUtilityReasoningEffortOptions: SettingsTabBuilderOptions["utilityReasoningEffortOptions"];
  isUtilityReasoningEffortSupported: SettingsTabBuilderOptions["isUtilityReasoningEffortSupported"];
  utilityAzureDeploymentError: SettingsTabBuilderOptions["utilityAzureDeploymentError"];
  handleUtilityProjectChange: SettingsTabBuilderOptions["onUtilityProjectChange"];
  handleUtilityDeploymentChange: SettingsTabBuilderOptions["onUtilityDeploymentChange"];
  handleUtilityReasoningEffortChange: SettingsTabBuilderOptions["onUtilityReasoningEffortChange"];
  workspaceMcpServerProfileOptions: McpServersTabBuilderOptions["workspaceMcpServerProfileOptions"];
  selectedWorkspaceMcpServerProfileCount: McpServersTabBuilderOptions["selectedWorkspaceMcpServerProfileCount"];
  isActiveThreadArchived: McpServersTabBuilderOptions["isThreadReadOnly"];
  isLoadingWorkspaceMcpServerProfiles: McpServersTabBuilderOptions["isLoadingWorkspaceMcpServerProfiles"];
  isMutatingWorkspaceMcpServerProfiles: McpServersTabBuilderOptions["isMutatingWorkspaceMcpServerProfiles"];
  workspaceMcpServerProfileError: McpServersTabBuilderOptions["workspaceMcpServerProfileError"];
  handleToggleWorkspaceMcpServerProfile: McpServersTabBuilderOptions["onToggleWorkspaceMcpServerProfile"];
  handleEditWorkspaceMcpServerProfile: McpServersTabBuilderOptions["onEditWorkspaceMcpServerProfile"];
  handleDeleteWorkspaceMcpServerProfile: McpServersTabBuilderOptions["onDeleteWorkspaceMcpServerProfile"];
  handleReloadWorkspaceMcpServerProfiles: McpServersTabBuilderOptions["onReloadWorkspaceMcpServerProfiles"];
  isEditingMcpServer: McpServersTabBuilderOptions["isEditingMcpServer"];
  editingMcpServerName: McpServersTabBuilderOptions["editingMcpServerName"];
  mcpNameInput: McpServersTabBuilderOptions["mcpNameInput"];
  setMcpNameInput: McpServersTabBuilderOptions["onMcpNameInputChange"];
  mcpTransport: McpServersTabBuilderOptions["mcpTransport"];
  setMcpTransport: ValueSetter<McpServersTabBuilderOptions["mcpTransport"]>;
  setMcpFormError: ValueSetter<string | null>;
  mcpCommandInput: McpServersTabBuilderOptions["mcpCommandInput"];
  setMcpCommandInput: McpServersTabBuilderOptions["onMcpCommandInputChange"];
  mcpArgsInput: McpServersTabBuilderOptions["mcpArgsInput"];
  setMcpArgsInput: McpServersTabBuilderOptions["onMcpArgsInputChange"];
  mcpCwdInput: McpServersTabBuilderOptions["mcpCwdInput"];
  setMcpCwdInput: McpServersTabBuilderOptions["onMcpCwdInputChange"];
  mcpEnvInput: McpServersTabBuilderOptions["mcpEnvInput"];
  setMcpEnvInput: McpServersTabBuilderOptions["onMcpEnvInputChange"];
  mcpUrlInput: McpServersTabBuilderOptions["mcpUrlInput"];
  setMcpUrlInput: McpServersTabBuilderOptions["onMcpUrlInputChange"];
  mcpHeadersInput: McpServersTabBuilderOptions["mcpHeadersInput"];
  setMcpHeadersInput: McpServersTabBuilderOptions["onMcpHeadersInputChange"];
  mcpUseAzureAuthInput: McpServersTabBuilderOptions["mcpUseAzureAuthInput"];
  setMcpUseAzureAuthInput: ValueSetter<boolean>;
  mcpAzureAuthScopeInput: McpServersTabBuilderOptions["mcpAzureAuthScopeInput"];
  setMcpAzureAuthScopeInput: ValueSetter<string>;
  mcpTimeoutSecondsInput: McpServersTabBuilderOptions["mcpTimeoutSecondsInput"];
  setMcpTimeoutSecondsInput: McpServersTabBuilderOptions["onMcpTimeoutSecondsInputChange"];
  handleAddMcpServer: McpServersTabBuilderOptions["onAddMcpServer"];
  handleCancelMcpServerEdit: McpServersTabBuilderOptions["onCancelMcpServerEdit"];
  isSavingMcpServer: McpServersTabBuilderOptions["isSavingMcpServer"];
  mcpFormError: McpServersTabBuilderOptions["mcpFormError"];
  mcpFormWarning: McpServersTabBuilderOptions["mcpFormWarning"];
  setMcpFormWarning: ValueSetter<string | null>;
  agentInstruction: ThreadsTabBuilderOptions["agentInstruction"];
  instructionContextToggles: ThreadsTabBuilderOptions["instructionContextToggles"];
  instructionEnhanceComparison: ThreadsTabBuilderOptions["instructionEnhanceComparison"];
  isEnhancingInstruction: ThreadsTabBuilderOptions["isEnhancingInstruction"];
  isEnhancingInstructionForActiveThread: ThreadsTabBuilderOptions["showEnhancingInstructionSpinner"];
  isSavingInstructionPrompt: ThreadsTabBuilderOptions["isSavingInstructionPrompt"];
  canSaveAgentInstructionPrompt: ThreadsTabBuilderOptions["canSaveAgentInstructionPrompt"];
  canEnhanceAgentInstruction: ThreadsTabBuilderOptions["canEnhanceAgentInstruction"];
  canClearAgentInstruction: ThreadsTabBuilderOptions["canClearAgentInstruction"];
  loadedInstructionFileName: ThreadsTabBuilderOptions["loadedInstructionFileName"];
  instructionFileInputRef: ThreadsTabBuilderOptions["instructionFileInputRef"];
  instructionFileError: ThreadsTabBuilderOptions["instructionFileError"];
  instructionSaveError: ThreadsTabBuilderOptions["instructionSaveError"];
  instructionSaveSuccess: ThreadsTabBuilderOptions["instructionSaveSuccess"];
  instructionEnhanceError: ThreadsTabBuilderOptions["instructionEnhanceError"];
  instructionEnhanceSuccess: ThreadsTabBuilderOptions["instructionEnhanceSuccess"];
  setInstructionSaveSuccess: ValueSetter<string | null>;
  setInstructionEnhanceSuccess: ValueSetter<string | null>;
  handleInstructionContextToggleChange: ThreadsTabBuilderOptions["onInstructionContextToggleChange"];
  handleAgentInstructionChange: ThreadsTabBuilderOptions["onAgentInstructionChange"];
  handleInstructionFileChange: ThreadsTabBuilderOptions["onInstructionFileChange"];
  handleSaveInstructionPrompt: ThreadsTabBuilderOptions["onSaveInstructionPrompt"];
  handleEnhanceInstruction: ThreadsTabBuilderOptions["onEnhanceInstruction"];
  handleClearInstruction: ThreadsTabBuilderOptions["onClearInstruction"];
  handleAdoptEnhancedInstruction: ThreadsTabBuilderOptions["onAdoptEnhancedInstruction"];
  handleAdoptOriginalInstruction: ThreadsTabBuilderOptions["onAdoptOriginalInstruction"];
  activeThreadOptions: ThreadsTabBuilderOptions["activeThreadOptions"];
  archivedThreadOptions: ThreadsTabBuilderOptions["archivedThreadOptions"];
  activeThreadId: ThreadsTabBuilderOptions["activeThreadId"];
  isLoadingThreads: ThreadsTabBuilderOptions["isLoadingThreads"];
  isSwitchingThread: ThreadsTabBuilderOptions["isSwitchingThread"];
  isCreatingThread: ThreadsTabBuilderOptions["isCreatingThread"];
  isDeletingThread: ThreadsTabBuilderOptions["isDeletingThread"];
  isClearingThread: ThreadsTabBuilderOptions["isClearingThread"];
  isRestoringThread: ThreadsTabBuilderOptions["isRestoringThread"];
  threadError: ThreadsTabBuilderOptions["threadError"];
  handleThreadChange: ThreadsTabBuilderOptions["onActiveThreadChange"];
  handleCreateThread: ThreadsTabBuilderOptions["onCreateThread"];
  handleThreadRename: ThreadsTabBuilderOptions["onThreadRename"];
  handleThreadCancel: ThreadsTabBuilderOptions["onThreadCancel"];
  handleThreadLogicalDelete: ThreadsTabBuilderOptions["onThreadDelete"];
  handleThreadClear: ThreadsTabBuilderOptions["onThreadClear"];
  handleThreadRestore: ThreadsTabBuilderOptions["onThreadRestore"];
  threadSkillOptions: SkillsTabBuilderOptions["threadSkillOptions"];
  isLoadingSkills: SkillsTabBuilderOptions["isLoadingSkills"];
  skillsError: SkillsTabBuilderOptions["skillsError"];
  skillsWarning: SkillsTabBuilderOptions["skillsWarning"];
  handleReloadSkills: SkillsTabBuilderOptions["onReloadSkills"];
  handleToggleThreadSkill: SkillsTabBuilderOptions["onToggleThreadSkill"];
  setSkillsWarning: ValueSetter<string | null>;
  skillRegistryGroups: SkillsTabBuilderOptions["skillRegistryGroups"];
  isMutatingSkillRegistries: SkillsTabBuilderOptions["isMutatingSkillRegistries"];
  skillRegistryError: SkillsTabBuilderOptions["skillRegistryError"];
  skillRegistryWarning: SkillsTabBuilderOptions["skillRegistryWarning"];
  skillRegistrySuccess: SkillsTabBuilderOptions["skillRegistrySuccess"];
  handleToggleRegistrySkill: SkillsTabBuilderOptions["onToggleRegistrySkill"];
  setSkillRegistryWarning: ValueSetter<string | null>;
  setSkillRegistrySuccess: ValueSetter<string | null>;
};

type BuildWorkspaceMcpServersTabPropsOptions = Pick<
  BuildWorkspaceConfigPanelPropsOptions,
  | "workspaceMcpServerProfileOptions"
  | "selectedWorkspaceMcpServerProfileCount"
  | "isSending"
  | "isActiveThreadArchived"
  | "isLoadingWorkspaceMcpServerProfiles"
  | "isMutatingWorkspaceMcpServerProfiles"
  | "workspaceMcpServerProfileError"
  | "handleToggleWorkspaceMcpServerProfile"
  | "handleEditWorkspaceMcpServerProfile"
  | "handleDeleteWorkspaceMcpServerProfile"
  | "handleReloadWorkspaceMcpServerProfiles"
  | "isEditingMcpServer"
  | "editingMcpServerName"
  | "mcpNameInput"
  | "setMcpNameInput"
  | "mcpTransport"
  | "setMcpTransport"
  | "setMcpFormError"
  | "mcpCommandInput"
  | "setMcpCommandInput"
  | "mcpArgsInput"
  | "setMcpArgsInput"
  | "mcpCwdInput"
  | "setMcpCwdInput"
  | "mcpEnvInput"
  | "setMcpEnvInput"
  | "mcpUrlInput"
  | "setMcpUrlInput"
  | "mcpHeadersInput"
  | "setMcpHeadersInput"
  | "mcpUseAzureAuthInput"
  | "setMcpUseAzureAuthInput"
  | "mcpAzureAuthScopeInput"
  | "setMcpAzureAuthScopeInput"
  | "mcpTimeoutSecondsInput"
  | "setMcpTimeoutSecondsInput"
  | "handleAddMcpServer"
  | "handleCancelMcpServerEdit"
  | "isSavingMcpServer"
  | "mcpFormError"
  | "mcpFormWarning"
  | "setMcpFormWarning"
>;

export function buildWorkspaceMcpServersTabProps(
  options: BuildWorkspaceMcpServersTabPropsOptions,
) {
  return buildMcpServersTabProps({
    workspaceMcpServerProfileOptions: options.workspaceMcpServerProfileOptions,
    selectedWorkspaceMcpServerProfileCount:
      options.selectedWorkspaceMcpServerProfileCount,
    isSending: options.isSending,
    isThreadReadOnly: options.isActiveThreadArchived,
    isLoadingWorkspaceMcpServerProfiles:
      options.isLoadingWorkspaceMcpServerProfiles,
    isMutatingWorkspaceMcpServerProfiles:
      options.isMutatingWorkspaceMcpServerProfiles,
    workspaceMcpServerProfileError: options.workspaceMcpServerProfileError,
    onToggleWorkspaceMcpServerProfile:
      options.handleToggleWorkspaceMcpServerProfile,
    onEditWorkspaceMcpServerProfile:
      options.handleEditWorkspaceMcpServerProfile,
    onDeleteWorkspaceMcpServerProfile: (serverId: string) => {
      void options.handleDeleteWorkspaceMcpServerProfile(serverId);
    },
    onReloadWorkspaceMcpServerProfiles:
      options.handleReloadWorkspaceMcpServerProfiles,
    isEditingMcpServer: options.isEditingMcpServer,
    editingMcpServerName: options.editingMcpServerName,
    mcpNameInput: options.mcpNameInput,
    onMcpNameInputChange: options.setMcpNameInput,
    mcpTransport: options.mcpTransport,
    onMcpTransportChange: (value) => {
      options.setMcpTransport(value);
      options.setMcpFormError(null);
    },
    mcpCommandInput: options.mcpCommandInput,
    onMcpCommandInputChange: options.setMcpCommandInput,
    mcpArgsInput: options.mcpArgsInput,
    onMcpArgsInputChange: options.setMcpArgsInput,
    mcpCwdInput: options.mcpCwdInput,
    onMcpCwdInputChange: options.setMcpCwdInput,
    mcpEnvInput: options.mcpEnvInput,
    onMcpEnvInputChange: options.setMcpEnvInput,
    mcpUrlInput: options.mcpUrlInput,
    onMcpUrlInputChange: options.setMcpUrlInput,
    mcpHeadersInput: options.mcpHeadersInput,
    onMcpHeadersInputChange: options.setMcpHeadersInput,
    mcpUseAzureAuthInput: options.mcpUseAzureAuthInput,
    onMcpUseAzureAuthInputChange: (checked: boolean) => {
      options.setMcpUseAzureAuthInput(checked);
      if (checked && !options.mcpAzureAuthScopeInput.trim()) {
        options.setMcpAzureAuthScopeInput(MCP_DEFAULT_AZURE_AUTH_SCOPE);
      }
    },
    mcpAzureAuthScopeInput: options.mcpAzureAuthScopeInput,
    onMcpAzureAuthScopeInputChange: options.setMcpAzureAuthScopeInput,
    mcpTimeoutSecondsInput: options.mcpTimeoutSecondsInput,
    onMcpTimeoutSecondsInputChange: options.setMcpTimeoutSecondsInput,
    defaultMcpAzureAuthScope: MCP_DEFAULT_AZURE_AUTH_SCOPE,
    defaultMcpTimeoutSeconds: MCP_DEFAULT_TIMEOUT_SECONDS,
    minMcpTimeoutSeconds: MCP_TIMEOUT_SECONDS_MIN,
    maxMcpTimeoutSeconds: MCP_TIMEOUT_SECONDS_MAX,
    onAddMcpServer: options.handleAddMcpServer,
    onCancelMcpServerEdit: options.handleCancelMcpServerEdit,
    isSavingMcpServer: options.isSavingMcpServer,
    mcpFormError: options.mcpFormError,
    mcpFormWarning: options.mcpFormWarning,
    onClearMcpFormWarning: () => {
      options.setMcpFormWarning(null);
    },
  });
}

function buildWorkspaceThreadsTabProps(
  options: BuildWorkspaceConfigPanelPropsOptions,
) {
  return buildThreadsTabProps({
    agentInstruction: options.agentInstruction,
    instructionContextToggles: options.instructionContextToggles,
    instructionEnhanceComparison: options.instructionEnhanceComparison,
    describeInstructionLanguage,
    isSending: options.isSending,
    isThreadReadOnly: options.isActiveThreadArchived,
    isEnhancingInstruction: options.isEnhancingInstruction,
    showEnhancingInstructionSpinner: options.isEnhancingInstructionForActiveThread,
    isSavingInstructionPrompt: options.isSavingInstructionPrompt,
    canSaveAgentInstructionPrompt: options.canSaveAgentInstructionPrompt,
    canEnhanceAgentInstruction: options.canEnhanceAgentInstruction,
    canClearAgentInstruction: options.canClearAgentInstruction,
    loadedInstructionFileName: options.loadedInstructionFileName,
    instructionFileInputRef: options.instructionFileInputRef,
    instructionFileError: options.instructionFileError,
    instructionSaveError: options.instructionSaveError,
    instructionSaveSuccess: options.instructionSaveSuccess,
    instructionEnhanceError: options.instructionEnhanceError,
    instructionEnhanceSuccess: options.instructionEnhanceSuccess,
    onClearInstructionSaveSuccess: () => {
      options.setInstructionSaveSuccess(null);
    },
    onClearInstructionEnhanceSuccess: () => {
      options.setInstructionEnhanceSuccess(null);
    },
    onInstructionContextToggleChange:
      options.handleInstructionContextToggleChange,
    onAgentInstructionChange: options.handleAgentInstructionChange,
    onInstructionFileChange: options.handleInstructionFileChange,
    onSaveInstructionPrompt: options.handleSaveInstructionPrompt,
    onEnhanceInstruction: options.handleEnhanceInstruction,
    onClearInstruction: options.handleClearInstruction,
    onAdoptEnhancedInstruction: options.handleAdoptEnhancedInstruction,
    onAdoptOriginalInstruction: options.handleAdoptOriginalInstruction,
    activeThreadOptions: options.activeThreadOptions,
    archivedThreadOptions: options.archivedThreadOptions,
    activeThreadId: options.activeThreadId,
    isLoadingThreads: options.isLoadingThreads,
    isSwitchingThread: options.isSwitchingThread,
    isCreatingThread: options.isCreatingThread,
    isDeletingThread: options.isDeletingThread,
    isClearingThread: options.isClearingThread,
    isRestoringThread: options.isRestoringThread,
    threadError: options.threadError,
    onActiveThreadChange: (threadId: string) => {
      void options.handleThreadChange(threadId);
    },
    onCreateThread: () => {
      void options.handleCreateThread();
    },
    onThreadRename: (threadId: string, nextName: string) => {
      void options.handleThreadRename(threadId, nextName);
    },
    onThreadCancel: (threadId: string) => {
      options.handleThreadCancel(threadId);
    },
    onThreadDelete: (threadId: string) => {
      void options.handleThreadLogicalDelete(threadId);
    },
    onThreadClear: (threadId: string) => {
      void options.handleThreadClear(threadId);
    },
    onThreadRestore: (threadId: string) => {
      void options.handleThreadRestore(threadId);
    },
  });
}

function buildWorkspaceSkillsTabProps(
  options: BuildWorkspaceConfigPanelPropsOptions,
) {
  return buildSkillsTabProps({
    threadSkillOptions: options.threadSkillOptions,
    isLoadingSkills: options.isLoadingSkills,
    isSending: options.isSending,
    isThreadReadOnly: options.isActiveThreadArchived,
    skillsError: options.skillsError,
    skillsWarning: options.skillsWarning,
    onReloadSkills: options.handleReloadSkills,
    onToggleThreadSkill: options.handleToggleThreadSkill,
    onClearSkillsWarning: () => {
      options.setSkillsWarning(null);
    },
    skillRegistryGroups: options.skillRegistryGroups,
    isMutatingSkillRegistries: options.isMutatingSkillRegistries,
    skillRegistryError: options.skillRegistryError,
    skillRegistryWarning: options.skillRegistryWarning,
    skillRegistrySuccess: options.skillRegistrySuccess,
    onToggleRegistrySkill: options.handleToggleRegistrySkill,
    onClearSkillRegistryWarning: () => {
      options.setSkillRegistryWarning(null);
    },
    onClearSkillRegistrySuccess: () => {
      options.setSkillRegistrySuccess(null);
    },
  });
}

export function buildWorkspaceConfigPanelProps(
  options: BuildWorkspaceConfigPanelPropsOptions,
) {
  const settingsTabProps = buildSettingsTabProps({
    theme: options.theme,
    onThemeChange: options.handleThemeChange,
    isAzureAuthRequired: options.isAzureAuthRequired,
    isSending: options.isSending,
    isStartingAzureLogin: options.isStartingAzureLogin,
    onAzureLogin: options.handleAzureLogin,
    azureTenants: options.azureTenants,
    activeAzureTenantId: options.activeAzureTenantId,
    isSwitchingAzureTenant: options.isSwitchingAzureTenant,
    onAzureTenantChange: options.handleAzureTenantChange,
    isLoadingAzureConnections: options.isLoadingAzureConnections,
    isLoadingAzureDeployments:
      options.isLoadingPlaygroundAzureDeployments ||
      options.isLoadingUtilityAzureDeployments,
    isReloadingAzureCatalog: options.isReloadingAzureCatalog,
    onAzureCatalogReload: options.handleReloadAzureCatalog,
    activeAzureConnection: options.activePlaygroundAzureConnection,
    activeAzurePrincipal: options.activeAzurePrincipal,
    selectedPlaygroundAzureDeploymentName:
      options.selectedPlaygroundAzureDeploymentName,
    isStartingAzureLogout: options.isStartingAzureLogout,
    onAzureLogout: options.handleAzureLogout,
    azureTenantSwitchError: options.azureTenantSwitchError,
    azureLogoutError: options.azureLogoutError,
    azureConnectionError: options.azureConnectionError,
    azureConnections: options.azureConnections,
    selectedUtilityAzureConnectionId: options.selectedUtilityAzureConnectionId,
    selectedUtilityAzureDeploymentName:
      options.selectedUtilityAzureDeploymentName,
    utilityAzureDeployments: options.utilityAzureDeploymentNames,
    utilityReasoningEffort: options.effectiveUtilityReasoningEffort,
    utilityReasoningEffortOptions:
      options.effectiveUtilityReasoningEffortOptions,
    isUtilityReasoningEffortSupported:
      options.isUtilityReasoningEffortSupported,
    utilityAzureDeploymentError: options.utilityAzureDeploymentError,
    onUtilityProjectChange: options.handleUtilityProjectChange,
    onUtilityDeploymentChange: options.handleUtilityDeploymentChange,
    onUtilityReasoningEffortChange:
      options.handleUtilityReasoningEffortChange,
    isLoadingUtilityAzureDeployments:
      options.isLoadingUtilityAzureDeployments,
  });

  const mcpServersTabProps = buildWorkspaceMcpServersTabProps(options);
  const threadsTabProps = buildWorkspaceThreadsTabProps(options);
  const skillsTabProps = buildWorkspaceSkillsTabProps(options);

  return {
    activeMainTab: options.activeMainTab,
    onMainTabChange: options.setActiveMainTab,
    isChatLocked: options.isChatLocked,
    settingsTabProps,
    mcpServersTabProps,
    skillsTabProps,
    threadsTabProps,
  };
}
