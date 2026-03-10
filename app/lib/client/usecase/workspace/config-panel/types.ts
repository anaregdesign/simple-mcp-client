import type {
  buildMcpServersTabProps as selectMcpServersTabProps,
  buildSettingsTabProps as selectSettingsTabProps,
  buildSkillsTabProps as selectSkillsTabProps,
  buildThreadsTabProps as selectThreadsTabProps,
} from "~/lib/client/usecase/workspace/config-panel/selectors";
import type { MainViewTab } from "~/lib/client/usecase/workspace/config-panel/main-view-tab";

type SettingsTabSelectorOptions = Parameters<typeof selectSettingsTabProps>[0];
type McpServersTabSelectorOptions = Parameters<typeof selectMcpServersTabProps>[0];
type ThreadsTabSelectorOptions = Parameters<typeof selectThreadsTabProps>[0];
type SkillsTabSelectorOptions = Parameters<typeof selectSkillsTabProps>[0];

export type ValueSetter<T> = (value: T) => void;

export type WorkspaceConfigPanelChromeOptions = {
  activeMainTab: MainViewTab;
  setActiveMainTab: ValueSetter<MainViewTab>;
  isChatLocked: boolean;
};

export type WorkspaceConfigPanelSettingsOptions = SettingsTabSelectorOptions;

export type WorkspaceConfigPanelMcpServersOptions = {
  workspaceMcpServerProfileOptions: McpServersTabSelectorOptions["workspaceMcpServerProfileOptions"];
  selectedWorkspaceMcpServerProfileCount: McpServersTabSelectorOptions["selectedWorkspaceMcpServerProfileCount"];
  isSending: McpServersTabSelectorOptions["isSending"];
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
};

export type WorkspaceConfigPanelThreadsOptions = {
  agentInstruction: ThreadsTabSelectorOptions["agentInstruction"];
  instructionContextToggles: ThreadsTabSelectorOptions["instructionContextToggles"];
  instructionEnhanceComparison: ThreadsTabSelectorOptions["instructionEnhanceComparison"];
  isSending: ThreadsTabSelectorOptions["isSending"];
  isActiveThreadArchived: ThreadsTabSelectorOptions["isThreadReadOnly"];
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
  clearInstructionSaveSuccess: () => void;
  clearInstructionEnhanceSuccess: () => void;
  handleInstructionContextToggleChange: ThreadsTabSelectorOptions["onInstructionContextToggleChange"];
  handleAgentInstructionChange: ThreadsTabSelectorOptions["onAgentInstructionChange"];
  handleOpenInstructionFilePicker: ThreadsTabSelectorOptions["onOpenInstructionFilePicker"];
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
  handleThreadCancel: (threadId: string) => void;
  handleThreadLogicalDelete: ThreadsTabSelectorOptions["onThreadDelete"];
  handleThreadClear: ThreadsTabSelectorOptions["onThreadClear"];
  handleThreadRestore: ThreadsTabSelectorOptions["onThreadRestore"];
};

export type WorkspaceConfigPanelSkillsOptions = {
  threadSkillOptions: SkillsTabSelectorOptions["threadSkillOptions"];
  isLoadingSkills: SkillsTabSelectorOptions["isLoadingSkills"];
  isSending: SkillsTabSelectorOptions["isSending"];
  isActiveThreadArchived: SkillsTabSelectorOptions["isThreadReadOnly"];
  skillsError: SkillsTabSelectorOptions["skillsError"];
  skillsWarning: SkillsTabSelectorOptions["skillsWarning"];
  handleReloadSkills: SkillsTabSelectorOptions["onReloadSkills"];
  handleToggleThreadSkill: SkillsTabSelectorOptions["onToggleThreadSkill"];
  clearSkillsWarning: () => void;
  skillRegistryGroups: SkillsTabSelectorOptions["skillRegistryGroups"];
  isMutatingSkillRegistries: SkillsTabSelectorOptions["isMutatingSkillRegistries"];
  skillRegistryError: SkillsTabSelectorOptions["skillRegistryError"];
  skillRegistryWarning: SkillsTabSelectorOptions["skillRegistryWarning"];
  skillRegistrySuccess: SkillsTabSelectorOptions["skillRegistrySuccess"];
  handleToggleRegistrySkill: SkillsTabSelectorOptions["onToggleRegistrySkill"];
  clearSkillRegistryWarning: () => void;
  clearSkillRegistrySuccess: () => void;
};

export type UseWorkspaceConfigPanelOptions = {
  chrome: WorkspaceConfigPanelChromeOptions;
  settings: WorkspaceConfigPanelSettingsOptions;
  mcpServers: WorkspaceConfigPanelMcpServersOptions;
  threads: WorkspaceConfigPanelThreadsOptions;
  skills: WorkspaceConfigPanelSkillsOptions;
};
