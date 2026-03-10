import {
  MCP_DEFAULT_AZURE_AUTH_SCOPE,
} from "~/lib/constants/mcp";
import type {
  BuildConfigPanelPropsOptions,
  BuildMcpServersTabPropsOptions,
} from "~/lib/client/usecase/workspace/config-panel/types";

export function createMcpServersTabHandlers(
  options: BuildMcpServersTabPropsOptions,
) {
  return {
    onToggleWorkspaceMcpServerProfile:
      options.handleToggleWorkspaceMcpServerProfile,
    onEditWorkspaceMcpServerProfile:
      options.handleEditWorkspaceMcpServerProfile,
    onDeleteWorkspaceMcpServerProfile(serverId: string) {
      void options.handleDeleteWorkspaceMcpServerProfile(serverId);
    },
    onReloadWorkspaceMcpServerProfiles:
      options.handleReloadWorkspaceMcpServerProfiles,
    onMcpNameInputChange: options.setMcpNameInput,
    onMcpTransportChange(value: BuildMcpServersTabPropsOptions["mcpTransport"]) {
      options.setMcpTransport(value);
      options.setMcpFormError(null);
    },
    onMcpCommandInputChange: options.setMcpCommandInput,
    onMcpArgsInputChange: options.setMcpArgsInput,
    onMcpCwdInputChange: options.setMcpCwdInput,
    onMcpEnvInputChange: options.setMcpEnvInput,
    onMcpUrlInputChange: options.setMcpUrlInput,
    onMcpHeadersInputChange: options.setMcpHeadersInput,
    onMcpUseAzureAuthInputChange(checked: boolean) {
      options.setMcpUseAzureAuthInput(checked);
      if (checked && !options.mcpAzureAuthScopeInput.trim()) {
        options.setMcpAzureAuthScopeInput(MCP_DEFAULT_AZURE_AUTH_SCOPE);
      }
    },
    onMcpAzureAuthScopeInputChange: options.setMcpAzureAuthScopeInput,
    onMcpTimeoutSecondsInputChange: options.setMcpTimeoutSecondsInput,
    onAddMcpServer: options.handleAddMcpServer,
    onCancelMcpServerEdit: options.handleCancelMcpServerEdit,
    onClearMcpFormWarning() {
      options.setMcpFormWarning(null);
    },
  };
}

export function createThreadsTabHandlers(
  options: BuildConfigPanelPropsOptions,
) {
  return {
    onClearInstructionSaveSuccess() {
      options.setInstructionSaveSuccess(null);
    },
    onClearInstructionEnhanceSuccess() {
      options.setInstructionEnhanceSuccess(null);
    },
    onInstructionContextToggleChange:
      options.handleInstructionContextToggleChange,
    onAgentInstructionChange: options.handleAgentInstructionChange,
    onOpenInstructionFilePicker: options.handleOpenInstructionFilePicker,
    onInstructionFileChange: options.handleInstructionFileChange,
    onSaveInstructionPrompt: options.handleSaveInstructionPrompt,
    onEnhanceInstruction: options.handleEnhanceInstruction,
    onClearInstruction: options.handleClearInstruction,
    onAdoptEnhancedInstruction: options.handleAdoptEnhancedInstruction,
    onAdoptOriginalInstruction: options.handleAdoptOriginalInstruction,
    onActiveThreadChange(threadId: string) {
      void options.handleThreadChange(threadId);
    },
    onCreateThread() {
      void options.handleCreateThread();
    },
    onThreadRename(threadId: string, nextName: string) {
      void options.handleThreadRename(threadId, nextName);
    },
    onThreadCancel(threadId: string) {
      options.handleThreadCancel(threadId);
    },
    onThreadDelete(threadId: string) {
      void options.handleThreadLogicalDelete(threadId);
    },
    onThreadClear(threadId: string) {
      void options.handleThreadClear(threadId);
    },
    onThreadRestore(threadId: string) {
      void options.handleThreadRestore(threadId);
    },
  };
}

export function createSkillsTabHandlers(
  options: BuildConfigPanelPropsOptions,
) {
  return {
    onReloadSkills: options.handleReloadSkills,
    onToggleThreadSkill: options.handleToggleThreadSkill,
    onClearSkillsWarning() {
      options.setSkillsWarning(null);
    },
    onToggleRegistrySkill: options.handleToggleRegistrySkill,
    onClearSkillRegistryWarning() {
      options.setSkillRegistryWarning(null);
    },
    onClearSkillRegistrySuccess() {
      options.setSkillRegistrySuccess(null);
    },
  };
}
