import type {
  buildMcpServersTabProps as selectMcpServersTabProps,
  buildSettingsTabProps as selectSettingsTabProps,
  buildSkillsTabProps as selectSkillsTabProps,
  buildThreadsTabProps as selectThreadsTabProps,
} from "~/lib/client/usecase/workspace/config-panel/selectors";
import type { MainViewTab } from "~/lib/client/usecase/workspace/view-types";

type SettingsTabSelectorOptions = Parameters<typeof selectSettingsTabProps>[0];
type McpServersTabSelectorOptions = Parameters<typeof selectMcpServersTabProps>[0];
type ThreadsTabSelectorOptions = Parameters<typeof selectThreadsTabProps>[0];
type SkillsTabSelectorOptions = Parameters<typeof selectSkillsTabProps>[0];

export type ValueSetter<T> = (value: T) => void;

export type BuildConfigPanelPropsOptions = {
  activeMainTab: MainViewTab;
  setActiveMainTab: ValueSetter<MainViewTab>;
  isChatLocked: boolean;
  theme: SettingsTabSelectorOptions["theme"];
  handleThemeChange: SettingsTabSelectorOptions["onThemeChange"];
  isAzureAuthRequired: SettingsTabSelectorOptions["isAzureAuthRequired"];
  isSending: SettingsTabSelectorOptions["isSending"];
  isStartingAzureLogin: SettingsTabSelectorOptions["isStartingAzureLogin"];
  handleAzureLogin: SettingsTabSelectorOptions["onAzureLogin"];
  azureTenants: SettingsTabSelectorOptions["azureTenants"];
  activeAzureTenantId: SettingsTabSelectorOptions["activeAzureTenantId"];
  isSwitchingAzureTenant: SettingsTabSelectorOptions["isSwitchingAzureTenant"];
  handleAzureTenantChange: SettingsTabSelectorOptions["onAzureTenantChange"];
  isLoadingAzureConnections: SettingsTabSelectorOptions["isLoadingAzureConnections"];
  isLoadingPlaygroundAzureDeployments: boolean;
  isLoadingUtilityAzureDeployments: SettingsTabSelectorOptions["isLoadingUtilityAzureDeployments"];
  isReloadingAzureCatalog: SettingsTabSelectorOptions["isReloadingAzureCatalog"];
  handleReloadAzureCatalog: SettingsTabSelectorOptions["onAzureCatalogReload"];
  activePlaygroundAzureConnection: SettingsTabSelectorOptions["activeAzureConnection"];
  activeAzurePrincipal: SettingsTabSelectorOptions["activeAzurePrincipal"];
  selectedPlaygroundAzureDeploymentName: SettingsTabSelectorOptions["selectedPlaygroundAzureDeploymentName"];
  isStartingAzureLogout: SettingsTabSelectorOptions["isStartingAzureLogout"];
  handleAzureLogout: SettingsTabSelectorOptions["onAzureLogout"];
  azureTenantSwitchError: SettingsTabSelectorOptions["azureTenantSwitchError"];
  azureLogoutError: SettingsTabSelectorOptions["azureLogoutError"];
  azureConnectionError: SettingsTabSelectorOptions["azureConnectionError"];
  azureConnections: SettingsTabSelectorOptions["azureConnections"];
  selectedUtilityAzureConnectionId: SettingsTabSelectorOptions["selectedUtilityAzureConnectionId"];
  selectedUtilityAzureDeploymentName: SettingsTabSelectorOptions["selectedUtilityAzureDeploymentName"];
  utilityAzureDeploymentNames: SettingsTabSelectorOptions["utilityAzureDeployments"];
  effectiveUtilityReasoningEffort: SettingsTabSelectorOptions["utilityReasoningEffort"];
  effectiveUtilityReasoningEffortOptions: SettingsTabSelectorOptions["utilityReasoningEffortOptions"];
  isUtilityReasoningEffortSupported: SettingsTabSelectorOptions["isUtilityReasoningEffortSupported"];
  utilityAzureDeploymentError: SettingsTabSelectorOptions["utilityAzureDeploymentError"];
  handleUtilityProjectChange: SettingsTabSelectorOptions["onUtilityProjectChange"];
  handleUtilityDeploymentChange: SettingsTabSelectorOptions["onUtilityDeploymentChange"];
  handleUtilityReasoningEffortChange: SettingsTabSelectorOptions["onUtilityReasoningEffortChange"];
  workspaceMcpServerProfileOptions: McpServersTabSelectorOptions["workspaceMcpServerProfileOptions"];
  selectedWorkspaceMcpServerProfileCount: McpServersTabSelectorOptions["selectedWorkspaceMcpServerProfileCount"];
  isActiveThreadArchived: McpServersTabSelectorOptions["isThreadReadOnly"];
  isLoadingWorkspaceMcpServerProfiles: McpServersTabSelectorOptions["isLoadingWorkspaceMcpServerProfiles"];
  isMutatingWorkspaceMcpServerProfiles: McpServersTabSelectorOptions["isMutatingWorkspaceMcpServerProfiles"];
  workspaceMcpServerProfileError: McpServersTabSelectorOptions["workspaceMcpServerProfileError"];
  handleToggleWorkspaceMcpServerProfile: McpServersTabSelectorOptions["onToggleWorkspaceMcpServerProfile"];
  handleEditWorkspaceMcpServerProfile: McpServersTabSelectorOptions["onEditWorkspaceMcpServerProfile"];
  handleDeleteWorkspaceMcpServerProfile: McpServersTabSelectorOptions["onDeleteWorkspaceMcpServerProfile"];
  handleReloadWorkspaceMcpServerProfiles: McpServersTabSelectorOptions["onReloadWorkspaceMcpServerProfiles"];
  isEditingMcpServer: McpServersTabSelectorOptions["isEditingMcpServer"];
  editingMcpServerName: McpServersTabSelectorOptions["editingMcpServerName"];
  mcpNameInput: McpServersTabSelectorOptions["mcpNameInput"];
  setMcpNameInput: McpServersTabSelectorOptions["onMcpNameInputChange"];
  mcpTransport: McpServersTabSelectorOptions["mcpTransport"];
  setMcpTransport: ValueSetter<McpServersTabSelectorOptions["mcpTransport"]>;
  setMcpFormError: ValueSetter<string | null>;
  mcpCommandInput: McpServersTabSelectorOptions["mcpCommandInput"];
  setMcpCommandInput: McpServersTabSelectorOptions["onMcpCommandInputChange"];
  mcpArgsInput: McpServersTabSelectorOptions["mcpArgsInput"];
  setMcpArgsInput: McpServersTabSelectorOptions["onMcpArgsInputChange"];
  mcpCwdInput: McpServersTabSelectorOptions["mcpCwdInput"];
  setMcpCwdInput: McpServersTabSelectorOptions["onMcpCwdInputChange"];
  mcpEnvInput: McpServersTabSelectorOptions["mcpEnvInput"];
  setMcpEnvInput: McpServersTabSelectorOptions["onMcpEnvInputChange"];
  mcpUrlInput: McpServersTabSelectorOptions["mcpUrlInput"];
  setMcpUrlInput: McpServersTabSelectorOptions["onMcpUrlInputChange"];
  mcpHeadersInput: McpServersTabSelectorOptions["mcpHeadersInput"];
  setMcpHeadersInput: McpServersTabSelectorOptions["onMcpHeadersInputChange"];
  mcpUseAzureAuthInput: McpServersTabSelectorOptions["mcpUseAzureAuthInput"];
  setMcpUseAzureAuthInput: ValueSetter<boolean>;
  mcpAzureAuthScopeInput: McpServersTabSelectorOptions["mcpAzureAuthScopeInput"];
  setMcpAzureAuthScopeInput: ValueSetter<string>;
  mcpTimeoutSecondsInput: McpServersTabSelectorOptions["mcpTimeoutSecondsInput"];
  setMcpTimeoutSecondsInput: McpServersTabSelectorOptions["onMcpTimeoutSecondsInputChange"];
  handleAddMcpServer: McpServersTabSelectorOptions["onAddMcpServer"];
  handleCancelMcpServerEdit: McpServersTabSelectorOptions["onCancelMcpServerEdit"];
  isSavingMcpServer: McpServersTabSelectorOptions["isSavingMcpServer"];
  mcpFormError: McpServersTabSelectorOptions["mcpFormError"];
  mcpFormWarning: McpServersTabSelectorOptions["mcpFormWarning"];
  setMcpFormWarning: ValueSetter<string | null>;
  agentInstruction: ThreadsTabSelectorOptions["agentInstruction"];
  instructionContextToggles: ThreadsTabSelectorOptions["instructionContextToggles"];
  instructionEnhanceComparison: ThreadsTabSelectorOptions["instructionEnhanceComparison"];
  isEnhancingInstruction: ThreadsTabSelectorOptions["isEnhancingInstruction"];
  isEnhancingInstructionForActiveThread: ThreadsTabSelectorOptions["showEnhancingInstructionSpinner"];
  isSavingInstructionPrompt: ThreadsTabSelectorOptions["isSavingInstructionPrompt"];
  canSaveAgentInstructionPrompt: ThreadsTabSelectorOptions["canSaveAgentInstructionPrompt"];
  canEnhanceAgentInstruction: ThreadsTabSelectorOptions["canEnhanceAgentInstruction"];
  canClearAgentInstruction: ThreadsTabSelectorOptions["canClearAgentInstruction"];
  loadedInstructionFileName: ThreadsTabSelectorOptions["loadedInstructionFileName"];
  instructionFileInputRef: ThreadsTabSelectorOptions["instructionFileInputRef"];
  instructionFileError: ThreadsTabSelectorOptions["instructionFileError"];
  instructionSaveError: ThreadsTabSelectorOptions["instructionSaveError"];
  instructionSaveSuccess: ThreadsTabSelectorOptions["instructionSaveSuccess"];
  instructionEnhanceError: ThreadsTabSelectorOptions["instructionEnhanceError"];
  instructionEnhanceSuccess: ThreadsTabSelectorOptions["instructionEnhanceSuccess"];
  setInstructionSaveSuccess: ValueSetter<string | null>;
  setInstructionEnhanceSuccess: ValueSetter<string | null>;
  handleInstructionContextToggleChange: ThreadsTabSelectorOptions["onInstructionContextToggleChange"];
  handleAgentInstructionChange: ThreadsTabSelectorOptions["onAgentInstructionChange"];
  handleInstructionFileChange: ThreadsTabSelectorOptions["onInstructionFileChange"];
  handleSaveInstructionPrompt: ThreadsTabSelectorOptions["onSaveInstructionPrompt"];
  handleEnhanceInstruction: ThreadsTabSelectorOptions["onEnhanceInstruction"];
  handleClearInstruction: ThreadsTabSelectorOptions["onClearInstruction"];
  handleAdoptEnhancedInstruction: ThreadsTabSelectorOptions["onAdoptEnhancedInstruction"];
  handleAdoptOriginalInstruction: ThreadsTabSelectorOptions["onAdoptOriginalInstruction"];
  activeThreadOptions: ThreadsTabSelectorOptions["activeThreadOptions"];
  archivedThreadOptions: ThreadsTabSelectorOptions["archivedThreadOptions"];
  activeThreadId: ThreadsTabSelectorOptions["activeThreadId"];
  isLoadingThreads: ThreadsTabSelectorOptions["isLoadingThreads"];
  isSwitchingThread: ThreadsTabSelectorOptions["isSwitchingThread"];
  isCreatingThread: ThreadsTabSelectorOptions["isCreatingThread"];
  isDeletingThread: ThreadsTabSelectorOptions["isDeletingThread"];
  isClearingThread: ThreadsTabSelectorOptions["isClearingThread"];
  isRestoringThread: ThreadsTabSelectorOptions["isRestoringThread"];
  threadError: ThreadsTabSelectorOptions["threadError"];
  handleThreadChange: ThreadsTabSelectorOptions["onActiveThreadChange"];
  handleCreateThread: ThreadsTabSelectorOptions["onCreateThread"];
  handleThreadRename: ThreadsTabSelectorOptions["onThreadRename"];
  handleThreadCancel: ThreadsTabSelectorOptions["onThreadCancel"];
  handleThreadLogicalDelete: ThreadsTabSelectorOptions["onThreadDelete"];
  handleThreadClear: ThreadsTabSelectorOptions["onThreadClear"];
  handleThreadRestore: ThreadsTabSelectorOptions["onThreadRestore"];
  threadSkillOptions: SkillsTabSelectorOptions["threadSkillOptions"];
  isLoadingSkills: SkillsTabSelectorOptions["isLoadingSkills"];
  skillsError: SkillsTabSelectorOptions["skillsError"];
  skillsWarning: SkillsTabSelectorOptions["skillsWarning"];
  handleReloadSkills: SkillsTabSelectorOptions["onReloadSkills"];
  handleToggleThreadSkill: SkillsTabSelectorOptions["onToggleThreadSkill"];
  setSkillsWarning: ValueSetter<string | null>;
  skillRegistryGroups: SkillsTabSelectorOptions["skillRegistryGroups"];
  isMutatingSkillRegistries: SkillsTabSelectorOptions["isMutatingSkillRegistries"];
  skillRegistryError: SkillsTabSelectorOptions["skillRegistryError"];
  skillRegistryWarning: SkillsTabSelectorOptions["skillRegistryWarning"];
  skillRegistrySuccess: SkillsTabSelectorOptions["skillRegistrySuccess"];
  handleToggleRegistrySkill: SkillsTabSelectorOptions["onToggleRegistrySkill"];
  setSkillRegistryWarning: ValueSetter<string | null>;
  setSkillRegistrySuccess: ValueSetter<string | null>;
};

export type BuildMcpServersTabPropsOptions = Pick<
  BuildConfigPanelPropsOptions,
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

export type UseConfigPanelOptions = Omit<
  BuildConfigPanelPropsOptions,
  "activeMainTab" | "setActiveMainTab"
>;
