import { useMemo } from "react";
import {
  MCP_DEFAULT_AZURE_AUTH_SCOPE,
  MCP_DEFAULT_TIMEOUT_SECONDS,
  MCP_TIMEOUT_SECONDS_MAX,
  MCP_TIMEOUT_SECONDS_MIN,
} from "~/lib/constants/mcp";
import {
  describeInstructionLanguage,
} from "~/lib/client/usecase/workspace/instruction-editor/instruction-format";
import {
  createMcpServersTabHandlers,
  createSkillsTabHandlers,
  createThreadsTabHandlers,
} from "~/lib/client/usecase/workspace/config-panel/handlers";
import {
  selectMcpServersTabViewModel,
  selectSettingsTabViewModel,
  selectSkillsTabViewModel,
  selectThreadsTabViewModel,
} from "~/lib/client/usecase/workspace/config-panel/selectors";
import type {
  UseWorkspaceConfigPanelOptions,
  WorkspaceConfigPanelMcpServersOptions,
} from "~/lib/client/usecase/workspace/config-panel/types";
import {
  useLockedConfigPanelTab,
} from "~/lib/client/usecase/workspace/config-panel/use-config-panel";

function buildMcpServersTabProps(
  options: WorkspaceConfigPanelMcpServersOptions,
) {
  const handlers = createMcpServersTabHandlers(options);

  return selectMcpServersTabViewModel({
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
      handlers.onToggleWorkspaceMcpServerProfile,
    onEditWorkspaceMcpServerProfile:
      handlers.onEditWorkspaceMcpServerProfile,
    onDeleteWorkspaceMcpServerProfile:
      handlers.onDeleteWorkspaceMcpServerProfile,
    onReloadWorkspaceMcpServerProfiles:
      handlers.onReloadWorkspaceMcpServerProfiles,
    isEditingMcpServer: options.isEditingMcpServer,
    editingMcpServerName: options.editingMcpServerName,
    mcpNameInput: options.mcpNameInput,
    onMcpNameInputChange: handlers.onMcpNameInputChange,
    mcpTransport: options.mcpTransport,
    onMcpTransportChange: handlers.onMcpTransportChange,
    mcpCommandInput: options.mcpCommandInput,
    onMcpCommandInputChange: handlers.onMcpCommandInputChange,
    mcpArgsInput: options.mcpArgsInput,
    onMcpArgsInputChange: handlers.onMcpArgsInputChange,
    mcpCwdInput: options.mcpCwdInput,
    onMcpCwdInputChange: handlers.onMcpCwdInputChange,
    mcpEnvInput: options.mcpEnvInput,
    onMcpEnvInputChange: handlers.onMcpEnvInputChange,
    mcpUrlInput: options.mcpUrlInput,
    onMcpUrlInputChange: handlers.onMcpUrlInputChange,
    mcpHeadersInput: options.mcpHeadersInput,
    onMcpHeadersInputChange: handlers.onMcpHeadersInputChange,
    mcpUseAzureAuthInput: options.mcpUseAzureAuthInput,
    onMcpUseAzureAuthInputChange: handlers.onMcpUseAzureAuthInputChange,
    mcpAzureAuthScopeInput: options.mcpAzureAuthScopeInput,
    onMcpAzureAuthScopeInputChange:
      handlers.onMcpAzureAuthScopeInputChange,
    mcpTimeoutSecondsInput: options.mcpTimeoutSecondsInput,
    onMcpTimeoutSecondsInputChange:
      handlers.onMcpTimeoutSecondsInputChange,
    defaultMcpAzureAuthScope: MCP_DEFAULT_AZURE_AUTH_SCOPE,
    defaultMcpTimeoutSeconds: MCP_DEFAULT_TIMEOUT_SECONDS,
    minMcpTimeoutSeconds: MCP_TIMEOUT_SECONDS_MIN,
    maxMcpTimeoutSeconds: MCP_TIMEOUT_SECONDS_MAX,
    onAddMcpServer: handlers.onAddMcpServer,
    onCancelMcpServerEdit: handlers.onCancelMcpServerEdit,
    isSavingMcpServer: options.isSavingMcpServer,
    mcpFormError: options.mcpFormError,
    mcpFormWarning: options.mcpFormWarning,
    onClearMcpFormWarning: handlers.onClearMcpFormWarning,
  });
}

function buildThreadsTabProps(
  options: UseWorkspaceConfigPanelOptions["threads"],
) {
  const handlers = createThreadsTabHandlers(options);

  return selectThreadsTabViewModel({
    agentInstruction: options.agentInstruction,
    instructionContextToggles: options.instructionContextToggles,
    instructionEnhanceComparison: options.instructionEnhanceComparison,
    describeInstructionLanguage,
    isSending: options.isSending,
    isThreadReadOnly: options.isActiveThreadArchived,
    isEnhancingInstruction: options.isEnhancingInstruction,
    showEnhancingInstructionSpinner:
      options.isEnhancingInstructionForActiveThread,
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
    onClearInstructionSaveSuccess: handlers.onClearInstructionSaveSuccess,
    onClearInstructionEnhanceSuccess:
      handlers.onClearInstructionEnhanceSuccess,
    onInstructionContextToggleChange:
      handlers.onInstructionContextToggleChange,
    onAgentInstructionChange: handlers.onAgentInstructionChange,
    onOpenInstructionFilePicker: handlers.onOpenInstructionFilePicker,
    onInstructionFileChange: handlers.onInstructionFileChange,
    onSaveInstructionPrompt: handlers.onSaveInstructionPrompt,
    onEnhanceInstruction: handlers.onEnhanceInstruction,
    onClearInstruction: handlers.onClearInstruction,
    onAdoptEnhancedInstruction: handlers.onAdoptEnhancedInstruction,
    onAdoptOriginalInstruction: handlers.onAdoptOriginalInstruction,
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
    onActiveThreadChange: handlers.onActiveThreadChange,
    onCreateThread: handlers.onCreateThread,
    onThreadRename: handlers.onThreadRename,
    onThreadCancel: handlers.onThreadCancel,
    onThreadDelete: handlers.onThreadDelete,
    onThreadClear: handlers.onThreadClear,
    onThreadRestore: handlers.onThreadRestore,
  });
}

function buildSkillsTabProps(
  options: UseWorkspaceConfigPanelOptions["skills"],
) {
  const handlers = createSkillsTabHandlers(options);

  return selectSkillsTabViewModel({
    threadSkillOptions: options.threadSkillOptions,
    isLoadingSkills: options.isLoadingSkills,
    isSending: options.isSending,
    isThreadReadOnly: options.isActiveThreadArchived,
    skillsError: options.skillsError,
    skillsWarning: options.skillsWarning,
    onReloadSkills: handlers.onReloadSkills,
    onToggleThreadSkill: handlers.onToggleThreadSkill,
    onClearSkillsWarning: handlers.onClearSkillsWarning,
    skillRegistryGroups: options.skillRegistryGroups,
    isMutatingSkillRegistries: options.isMutatingSkillRegistries,
    skillRegistryError: options.skillRegistryError,
    skillRegistryWarning: options.skillRegistryWarning,
    skillRegistrySuccess: options.skillRegistrySuccess,
    onToggleRegistrySkill: handlers.onToggleRegistrySkill,
    onClearSkillRegistryWarning: handlers.onClearSkillRegistryWarning,
    onClearSkillRegistrySuccess: handlers.onClearSkillRegistrySuccess,
  });
}

export function selectWorkspaceConfigPanelProps(
  options: UseWorkspaceConfigPanelOptions,
) {
  const settingsTabProps = selectSettingsTabViewModel({
    ...options.settings,
    isLoadingAzureDeployments:
      options.settings.isLoadingAzureDeployments ||
      options.settings.isLoadingUtilityAzureDeployments,
  });

  return {
    chrome: {
      activeMainTab: options.chrome.activeMainTab,
      onMainTabChange: options.chrome.setActiveMainTab,
      isChatLocked: options.chrome.isChatLocked,
    },
    tabs: {
      settings: settingsTabProps,
      mcpServers: buildMcpServersTabProps(options.mcpServers),
      skills: buildSkillsTabProps(options.skills),
      threads: buildThreadsTabProps(options.threads),
    },
  };
}

export function useWorkspaceConfigPanel(
  options: UseWorkspaceConfigPanelOptions,
) {
  useLockedConfigPanelTab({
    activeMainTab: options.chrome.activeMainTab,
    isChatLocked: options.chrome.isChatLocked,
    setActiveMainTab: options.chrome.setActiveMainTab,
  });

  const configPanelProps = useMemo(
    () => selectWorkspaceConfigPanelProps(options),
    [options],
  );

  return {
    configPanelProps,
  };
}
