import type { AzureSettingsController } from "~/lib/client/usecase/workspace/azure-settings/types";
import type { MainViewTab } from "~/lib/client/usecase/workspace/config-panel/main-view-tab";
import {
  useWorkspaceConfigPanel,
} from "~/lib/client/usecase/workspace/config-panel/use-workspace-config-panel";
import type {
  WorkspaceInstructionEditorController,
} from "~/lib/client/usecase/workspace/instruction-editor/use-workspace-instruction-editor";
import type {
  WorkspaceMcpProfilesController,
} from "~/lib/client/usecase/workspace/mcp-profiles/use-workspace-mcp-profiles";
import type { SkillCatalogController } from "~/lib/client/usecase/workspace/skills-catalog/use-skill-catalog";
import type { ThreadListOption } from "~/lib/client/usecase/workspace/threads/thread-runtime";

type WorkspaceConfigThreadViewState = {
  activeThreadOptions: ThreadListOption[];
  archivedThreadOptions: ThreadListOption[];
  activeThreadId: string;
  isSending: boolean;
  isActiveThreadArchived: boolean;
  isLoadingThreads: boolean;
  isSwitchingThread: boolean;
  isCreatingThread: boolean;
  isDeletingThread: boolean;
  isClearingThread: boolean;
  isRestoringThread: boolean;
  threadError: string | null;
};

type WorkspaceConfigThreadHandlers = {
  handleCreateThread: () => Promise<void> | void;
  handleThreadRename: (threadId: string, nextName: string) => Promise<void> | void;
  handleThreadCancel: (threadId: string) => void;
  handleThreadClear: (threadId: string) => Promise<void> | void;
  handleThreadLogicalDelete: (threadId: string) => Promise<void> | void;
  handleThreadRestore: (threadId: string) => Promise<void> | void;
  handleThreadChange: (threadId: string) => Promise<void> | void;
};

type UseWorkspaceConfigScreenOptions = {
  chrome: {
    activeMainTab: MainViewTab;
    setActiveMainTab: (nextTab: MainViewTab) => void;
    isChatLocked: boolean;
  };
  azureSettings: AzureSettingsController;
  instructionEditor: WorkspaceInstructionEditorController;
  mcpProfiles: WorkspaceMcpProfilesController;
  skillCatalog: SkillCatalogController;
  threadView: WorkspaceConfigThreadViewState;
  threadHandlers: WorkspaceConfigThreadHandlers;
};

export function useWorkspaceConfigScreen(
  options: UseWorkspaceConfigScreenOptions,
) {
  return useWorkspaceConfigPanel({
    chrome: options.chrome,
    settings: {
      theme: options.azureSettings.theme,
      onThemeChange: options.azureSettings.handleThemeChange,
      isAzureAuthRequired: options.azureSettings.isAzureAuthRequired,
      isSending: options.threadView.isSending,
      isStartingAzureLogin: options.azureSettings.isStartingAzureLogin,
      onAzureLogin: options.azureSettings.handleAzureLogin,
      azureTenants: options.azureSettings.azureTenants,
      activeAzureTenantId:
        options.azureSettings.activeAzurePrincipal?.tenantId ?? "",
      isSwitchingAzureTenant: options.azureSettings.isSwitchingAzureTenant,
      onAzureTenantChange: options.azureSettings.handleAzureTenantChange,
      isLoadingAzureConnections: options.azureSettings.isLoadingAzureConnections,
      isLoadingAzureDeployments:
        options.azureSettings.isLoadingPlaygroundAzureDeployments,
      isReloadingAzureCatalog: options.azureSettings.isReloadingAzureCatalog,
      onAzureCatalogReload: options.azureSettings.handleReloadAzureCatalog,
      activeAzureConnection: options.azureSettings.activePlaygroundAzureConnection,
      activeAzurePrincipal: options.azureSettings.activeAzurePrincipal,
      selectedPlaygroundAzureDeploymentName:
        options.azureSettings.selectedPlaygroundAzureDeploymentName,
      isStartingAzureLogout: options.azureSettings.isStartingAzureLogout,
      onAzureLogout: options.azureSettings.handleAzureLogout,
      azureTenantSwitchError: options.azureSettings.azureTenantSwitchError,
      azureLogoutError: options.azureSettings.azureLogoutError,
      azureConnectionError: options.azureSettings.azureConnectionError,
      azureConnections: options.azureSettings.azureConnections,
      selectedUtilityAzureConnectionId:
        options.azureSettings.selectedUtilityAzureConnectionId,
      selectedUtilityAzureDeploymentName:
        options.azureSettings.selectedUtilityAzureDeploymentName,
      utilityAzureDeployments:
        options.azureSettings.utilityAzureDeploymentNames,
      utilityReasoningEffort:
        options.azureSettings.effectiveUtilityReasoningEffort,
      utilityReasoningEffortOptions:
        options.azureSettings.effectiveUtilityReasoningEffortOptions,
      isUtilityReasoningEffortSupported:
        options.azureSettings.isUtilityReasoningEffortSupported,
      utilityAzureDeploymentError:
        options.azureSettings.utilityAzureDeploymentError,
      onUtilityProjectChange: options.instructionEditor.handleUtilityProjectChange,
      onUtilityDeploymentChange:
        options.instructionEditor.handleUtilityDeploymentChange,
      onUtilityReasoningEffortChange:
        options.instructionEditor.handleUtilityReasoningEffortChange,
      isLoadingUtilityAzureDeployments:
        options.azureSettings.isLoadingUtilityAzureDeployments,
    },
    mcpServers: {
      workspaceMcpServerProfileOptions:
        options.mcpProfiles.workspaceMcpServerProfileOptions,
      selectedWorkspaceMcpServerProfileCount:
        options.mcpProfiles.selectedWorkspaceMcpServerProfileCount,
      isSending: options.threadView.isSending,
      isActiveThreadArchived: options.threadView.isActiveThreadArchived,
      isLoadingWorkspaceMcpServerProfiles:
        options.mcpProfiles.isLoadingWorkspaceMcpServerProfiles,
      isMutatingWorkspaceMcpServerProfiles:
        options.mcpProfiles.isMutatingWorkspaceMcpServerProfiles,
      workspaceMcpServerProfileError:
        options.mcpProfiles.workspaceMcpServerProfileError,
      handleToggleWorkspaceMcpServerProfile:
        options.mcpProfiles.handleToggleWorkspaceMcpServerProfile,
      handleEditWorkspaceMcpServerProfile:
        options.mcpProfiles.handleEditWorkspaceMcpServerProfile,
      handleDeleteWorkspaceMcpServerProfile:
        options.mcpProfiles.handleDeleteWorkspaceMcpServerProfile,
      handleReloadWorkspaceMcpServerProfiles:
        options.mcpProfiles.handleReloadWorkspaceMcpServerProfiles,
      isEditingMcpServer: options.mcpProfiles.isEditingMcpServer,
      editingMcpServerName: options.mcpProfiles.editingMcpServerName,
      mcpNameInput: options.mcpProfiles.mcpNameInput,
      setMcpNameInput: options.mcpProfiles.setMcpNameInput,
      mcpTransport: options.mcpProfiles.mcpTransport,
      setMcpTransport: options.mcpProfiles.setMcpTransport,
      setMcpFormError: options.mcpProfiles.setMcpFormError,
      mcpCommandInput: options.mcpProfiles.mcpCommandInput,
      setMcpCommandInput: options.mcpProfiles.setMcpCommandInput,
      mcpArgsInput: options.mcpProfiles.mcpArgsInput,
      setMcpArgsInput: options.mcpProfiles.setMcpArgsInput,
      mcpCwdInput: options.mcpProfiles.mcpCwdInput,
      setMcpCwdInput: options.mcpProfiles.setMcpCwdInput,
      mcpEnvInput: options.mcpProfiles.mcpEnvInput,
      setMcpEnvInput: options.mcpProfiles.setMcpEnvInput,
      mcpUrlInput: options.mcpProfiles.mcpUrlInput,
      setMcpUrlInput: options.mcpProfiles.setMcpUrlInput,
      mcpHeadersInput: options.mcpProfiles.mcpHeadersInput,
      setMcpHeadersInput: options.mcpProfiles.setMcpHeadersInput,
      mcpUseAzureAuthInput: options.mcpProfiles.mcpUseAzureAuthInput,
      setMcpUseAzureAuthInput: options.mcpProfiles.setMcpUseAzureAuthInput,
      mcpAzureAuthScopeInput: options.mcpProfiles.mcpAzureAuthScopeInput,
      setMcpAzureAuthScopeInput:
        options.mcpProfiles.setMcpAzureAuthScopeInput,
      mcpTimeoutSecondsInput: options.mcpProfiles.mcpTimeoutSecondsInput,
      setMcpTimeoutSecondsInput: options.mcpProfiles.setMcpTimeoutSecondsInput,
      handleAddMcpServer: options.mcpProfiles.handleAddMcpServer,
      handleCancelMcpServerEdit: options.mcpProfiles.handleCancelMcpServerEdit,
      isSavingMcpServer: options.mcpProfiles.isSavingMcpServer,
      mcpFormError: options.mcpProfiles.mcpFormError,
      mcpFormWarning: options.mcpProfiles.mcpFormWarning,
      setMcpFormWarning: options.mcpProfiles.setMcpFormWarning,
    },
    threads: {
      agentInstruction: options.instructionEditor.agentInstruction,
      instructionContextToggles:
        options.instructionEditor.instructionContextToggles,
      instructionEnhanceComparison:
        options.instructionEditor.instructionEnhanceComparison,
      isSending: options.threadView.isSending,
      isActiveThreadArchived: options.threadView.isActiveThreadArchived,
      isEnhancingInstruction: options.instructionEditor.isEnhancingInstruction,
      isEnhancingInstructionForActiveThread:
        options.instructionEditor.isEnhancingInstructionForActiveThread,
      isSavingInstructionPrompt:
        options.instructionEditor.isSavingInstructionPrompt,
      canSaveAgentInstructionPrompt:
        options.instructionEditor.canSaveAgentInstructionPrompt,
      canEnhanceAgentInstruction:
        options.instructionEditor.canEnhanceAgentInstruction,
      canClearAgentInstruction:
        options.instructionEditor.canClearAgentInstruction,
      loadedInstructionFileName:
        options.instructionEditor.loadedInstructionFileName,
      instructionFileInputRef:
        options.instructionEditor.instructionFileInputRef,
      instructionFileError: options.instructionEditor.instructionFileError,
      instructionSaveError: options.instructionEditor.instructionSaveError,
      instructionSaveSuccess: options.instructionEditor.instructionSaveSuccess,
      instructionEnhanceError:
        options.instructionEditor.instructionEnhanceError,
      instructionEnhanceSuccess:
        options.instructionEditor.instructionEnhanceSuccess,
      clearInstructionSaveSuccess:
        options.instructionEditor.clearInstructionSaveSuccess,
      clearInstructionEnhanceSuccess:
        options.instructionEditor.clearInstructionEnhanceSuccess,
      handleInstructionContextToggleChange:
        options.instructionEditor.handleInstructionContextToggleChange,
      handleAgentInstructionChange:
        options.instructionEditor.handleAgentInstructionChange,
      handleOpenInstructionFilePicker:
        options.instructionEditor.handleOpenInstructionFilePicker,
      handleInstructionFileChange:
        options.instructionEditor.handleInstructionFileChange,
      handleSaveInstructionPrompt:
        options.instructionEditor.handleSaveInstructionPrompt,
      handleEnhanceInstruction:
        options.instructionEditor.handleEnhanceInstruction,
      handleClearInstruction:
        options.instructionEditor.handleClearInstruction,
      handleAdoptEnhancedInstruction:
        options.instructionEditor.handleAdoptEnhancedInstruction,
      handleAdoptOriginalInstruction:
        options.instructionEditor.handleAdoptOriginalInstruction,
      activeThreadOptions: options.threadView.activeThreadOptions,
      archivedThreadOptions: options.threadView.archivedThreadOptions,
      activeThreadId: options.threadView.activeThreadId,
      isLoadingThreads: options.threadView.isLoadingThreads,
      isSwitchingThread: options.threadView.isSwitchingThread,
      isCreatingThread: options.threadView.isCreatingThread,
      isDeletingThread: options.threadView.isDeletingThread,
      isClearingThread: options.threadView.isClearingThread,
      isRestoringThread: options.threadView.isRestoringThread,
      threadError: options.threadView.threadError,
      handleThreadChange: options.threadHandlers.handleThreadChange,
      handleCreateThread: options.threadHandlers.handleCreateThread,
      handleThreadRename: options.threadHandlers.handleThreadRename,
      handleThreadCancel: options.threadHandlers.handleThreadCancel,
      handleThreadLogicalDelete:
        options.threadHandlers.handleThreadLogicalDelete,
      handleThreadClear: options.threadHandlers.handleThreadClear,
      handleThreadRestore: options.threadHandlers.handleThreadRestore,
    },
    skills: {
      threadSkillOptions: options.skillCatalog.threadSkillOptions,
      isLoadingSkills: options.skillCatalog.isLoadingSkills,
      isSending: options.threadView.isSending,
      isActiveThreadArchived: options.threadView.isActiveThreadArchived,
      skillsError: options.skillCatalog.skillsError,
      skillsWarning: options.skillCatalog.skillsWarning,
      handleReloadSkills: options.skillCatalog.handleReloadSkills,
      handleToggleThreadSkill: options.skillCatalog.handleToggleThreadSkill,
      clearSkillsWarning() {
        options.skillCatalog.setSkillsWarning(null);
      },
      skillRegistryGroups: options.skillCatalog.skillRegistryGroups,
      isMutatingSkillRegistries: options.skillCatalog.isMutatingSkillRegistries,
      skillRegistryError: options.skillCatalog.skillRegistryError,
      skillRegistryWarning: options.skillCatalog.skillRegistryWarning,
      skillRegistrySuccess: options.skillCatalog.skillRegistrySuccess,
      handleToggleRegistrySkill:
        options.skillCatalog.handleToggleRegistrySkill,
      clearSkillRegistryWarning() {
        options.skillCatalog.setSkillRegistryWarning(null);
      },
      clearSkillRegistrySuccess() {
        options.skillCatalog.setSkillRegistrySuccess(null);
      },
    },
  });
}
