import type {
  AzurePrincipalProfile,
  AzureProjectOption,
  AzureTenantOption,
} from "~/lib/client/usecase/workspace/azure-settings/parsers";
import type {
  WorkspaceMcpServerProfileOption,
} from "~/lib/client/usecase/workspace/mcp-profiles/selectors";
import {
  buildSkillRegistryGroups,
  type SelectableSkillOption,
} from "~/lib/client/usecase/workspace/skills-catalog/selectors";
import type { ThreadListOption } from "~/lib/client/usecase/workspace/threads/thread-runtime";
import type { McpTransport } from "~/lib/domain/value-objects/mcp-transport";
import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";
import type { ThemeMode } from "~/lib/domain/value-objects/theme-mode";
import type {
  InstructionEnhanceComparison,
} from "~/lib/client/usecase/workspace/instruction-editor/instruction-enhance-comparison";
import type {
  InstructionLanguage,
} from "~/lib/client/usecase/workspace/instruction-editor/view-types";
import {
  THREAD_INSTRUCTION_CONTEXT_OPTIONS,
} from "~/lib/domain/value-objects/thread-instruction-context";

type Callback = (...args: any[]) => void | Promise<void>;
type RefLike<T> = { current: T | null };

export function buildSettingsTabProps(options: {
  theme: ThemeMode;
  onThemeChange: (nextTheme: ThemeMode) => void;
  isAzureAuthRequired: boolean;
  isSending: boolean;
  isStartingAzureLogin: boolean;
  onAzureLogin: Callback;
  azureTenants: AzureTenantOption[];
  activeAzureTenantId: string;
  isSwitchingAzureTenant: boolean;
  onAzureTenantChange: Callback;
  isLoadingAzureConnections: boolean;
  isLoadingAzureDeployments: boolean;
  isReloadingAzureCatalog: boolean;
  onAzureCatalogReload: Callback;
  activeAzureConnection: AzureProjectOption | null;
  activeAzurePrincipal: AzurePrincipalProfile | null;
  selectedPlaygroundAzureDeploymentName: string;
  isStartingAzureLogout: boolean;
  onAzureLogout: Callback;
  azureTenantSwitchError: string | null;
  azureLogoutError: string | null;
  azureConnectionError: string | null;
  azureConnections: AzureProjectOption[];
  selectedUtilityAzureConnectionId: string;
  selectedUtilityAzureDeploymentName: string;
  utilityAzureDeployments: string[];
  utilityReasoningEffort: ReasoningEffort;
  utilityReasoningEffortOptions: ReasoningEffort[];
  isUtilityReasoningEffortSupported: boolean;
  utilityAzureDeploymentError: string | null;
  onUtilityProjectChange: Callback;
  onUtilityDeploymentChange: Callback;
  onUtilityReasoningEffortChange: (value: ReasoningEffort) => void;
  isLoadingUtilityAzureDeployments: boolean;
}) {
  return {
    appearanceSectionProps: {
      theme: options.theme,
      onThemeChange: options.onThemeChange,
    },
    azureConnectionSectionProps: {
      isAzureAuthRequired: options.isAzureAuthRequired,
      isSending: options.isSending,
      isStartingAzureLogin: options.isStartingAzureLogin,
      onAzureLogin: options.onAzureLogin,
      azureTenants: options.azureTenants,
      activeAzureTenantId: options.activeAzureTenantId,
      isSwitchingAzureTenant: options.isSwitchingAzureTenant,
      onAzureTenantChange: options.onAzureTenantChange,
      isLoadingAzureConnections: options.isLoadingAzureConnections,
      isLoadingAzureDeployments: options.isLoadingAzureDeployments,
      isReloadingAzureCatalog: options.isReloadingAzureCatalog,
      onAzureCatalogReload: options.onAzureCatalogReload,
      activeAzureConnection: options.activeAzureConnection,
      activeAzurePrincipal: options.activeAzurePrincipal,
      selectedPlaygroundAzureDeploymentName:
        options.selectedPlaygroundAzureDeploymentName,
      isStartingAzureLogout: options.isStartingAzureLogout,
      onAzureLogout: options.onAzureLogout,
      azureTenantSwitchError: options.azureTenantSwitchError,
      azureLogoutError: options.azureLogoutError,
      azureConnectionError: options.azureConnectionError,
    },
    utilityModelSectionProps: {
      isAzureAuthRequired: options.isAzureAuthRequired,
      isSending: options.isSending,
      isLoadingAzureConnections: options.isLoadingAzureConnections,
      isLoadingUtilityAzureDeployments:
        options.isLoadingUtilityAzureDeployments,
      azureConnections: options.azureConnections,
      selectedUtilityAzureConnectionId:
        options.selectedUtilityAzureConnectionId,
      selectedUtilityAzureDeploymentName:
        options.selectedUtilityAzureDeploymentName,
      utilityAzureDeployments: options.utilityAzureDeployments,
      utilityReasoningEffort: options.utilityReasoningEffort,
      utilityReasoningEffortOptions: options.utilityReasoningEffortOptions,
      isUtilityReasoningEffortSupported:
        options.isUtilityReasoningEffortSupported,
      utilityAzureDeploymentError: options.utilityAzureDeploymentError,
      onUtilityProjectChange: options.onUtilityProjectChange,
      onUtilityDeploymentChange: options.onUtilityDeploymentChange,
      onUtilityReasoningEffortChange:
        options.onUtilityReasoningEffortChange,
    },
  };
}

export function buildMcpServersTabProps(options: {
  workspaceMcpServerProfileOptions: WorkspaceMcpServerProfileOption[];
  selectedWorkspaceMcpServerProfileCount: number;
  isSending: boolean;
  isThreadReadOnly: boolean;
  isLoadingWorkspaceMcpServerProfiles: boolean;
  isMutatingWorkspaceMcpServerProfiles: boolean;
  workspaceMcpServerProfileError: string | null;
  onToggleWorkspaceMcpServerProfile: Callback;
  onEditWorkspaceMcpServerProfile: Callback;
  onDeleteWorkspaceMcpServerProfile: Callback;
  onReloadWorkspaceMcpServerProfiles: Callback;
  isEditingMcpServer: boolean;
  editingMcpServerName: string | null;
  mcpNameInput: string;
  onMcpNameInputChange: Callback;
  mcpTransport: McpTransport;
  onMcpTransportChange: (value: McpTransport) => void;
  mcpCommandInput: string;
  onMcpCommandInputChange: Callback;
  mcpArgsInput: string;
  onMcpArgsInputChange: Callback;
  mcpCwdInput: string;
  onMcpCwdInputChange: Callback;
  mcpEnvInput: string;
  onMcpEnvInputChange: Callback;
  mcpUrlInput: string;
  onMcpUrlInputChange: Callback;
  mcpHeadersInput: string;
  onMcpHeadersInputChange: Callback;
  mcpUseAzureAuthInput: boolean;
  onMcpUseAzureAuthInputChange: Callback;
  mcpAzureAuthScopeInput: string;
  onMcpAzureAuthScopeInputChange: Callback;
  mcpTimeoutSecondsInput: string;
  onMcpTimeoutSecondsInputChange: Callback;
  defaultMcpAzureAuthScope: string;
  defaultMcpTimeoutSeconds: number;
  minMcpTimeoutSeconds: number;
  maxMcpTimeoutSeconds: number;
  onAddMcpServer: Callback;
  onCancelMcpServerEdit: Callback;
  isSavingMcpServer: boolean;
  mcpFormError: string | null;
  mcpFormWarning: string | null;
  onClearMcpFormWarning: Callback;
}) {
  return {
    workspaceMcpServerProfileOptions: options.workspaceMcpServerProfileOptions,
    selectedWorkspaceMcpServerProfileCount:
      options.selectedWorkspaceMcpServerProfileCount,
    isSending: options.isSending,
    isThreadReadOnly: options.isThreadReadOnly,
    isLoadingWorkspaceMcpServerProfiles:
      options.isLoadingWorkspaceMcpServerProfiles,
    isMutatingWorkspaceMcpServerProfiles:
      options.isMutatingWorkspaceMcpServerProfiles,
    workspaceMcpServerProfileError: options.workspaceMcpServerProfileError,
    onToggleWorkspaceMcpServerProfile:
      options.onToggleWorkspaceMcpServerProfile,
    onEditWorkspaceMcpServerProfile: options.onEditWorkspaceMcpServerProfile,
    onDeleteWorkspaceMcpServerProfile:
      options.onDeleteWorkspaceMcpServerProfile,
    onReloadWorkspaceMcpServerProfiles:
      options.onReloadWorkspaceMcpServerProfiles,
    isEditingMcpServer: options.isEditingMcpServer,
    editingMcpServerName: options.editingMcpServerName,
    mcpNameInput: options.mcpNameInput,
    onMcpNameInputChange: options.onMcpNameInputChange,
    mcpTransport: options.mcpTransport,
    onMcpTransportChange: options.onMcpTransportChange,
    mcpCommandInput: options.mcpCommandInput,
    onMcpCommandInputChange: options.onMcpCommandInputChange,
    mcpArgsInput: options.mcpArgsInput,
    onMcpArgsInputChange: options.onMcpArgsInputChange,
    mcpCwdInput: options.mcpCwdInput,
    onMcpCwdInputChange: options.onMcpCwdInputChange,
    mcpEnvInput: options.mcpEnvInput,
    onMcpEnvInputChange: options.onMcpEnvInputChange,
    mcpUrlInput: options.mcpUrlInput,
    onMcpUrlInputChange: options.onMcpUrlInputChange,
    mcpHeadersInput: options.mcpHeadersInput,
    onMcpHeadersInputChange: options.onMcpHeadersInputChange,
    mcpUseAzureAuthInput: options.mcpUseAzureAuthInput,
    onMcpUseAzureAuthInputChange: options.onMcpUseAzureAuthInputChange,
    mcpAzureAuthScopeInput: options.mcpAzureAuthScopeInput,
    onMcpAzureAuthScopeInputChange: options.onMcpAzureAuthScopeInputChange,
    mcpTimeoutSecondsInput: options.mcpTimeoutSecondsInput,
    onMcpTimeoutSecondsInputChange: options.onMcpTimeoutSecondsInputChange,
    defaultMcpAzureAuthScope: options.defaultMcpAzureAuthScope,
    defaultMcpTimeoutSeconds: options.defaultMcpTimeoutSeconds,
    minMcpTimeoutSeconds: options.minMcpTimeoutSeconds,
    maxMcpTimeoutSeconds: options.maxMcpTimeoutSeconds,
    onAddMcpServer: options.onAddMcpServer,
    onCancelMcpServerEdit: options.onCancelMcpServerEdit,
    isSavingMcpServer: options.isSavingMcpServer,
    mcpFormError: options.mcpFormError,
    mcpFormWarning: options.mcpFormWarning,
    onClearMcpFormWarning: options.onClearMcpFormWarning,
  };
}

export function buildThreadsTabProps(options: {
  agentInstruction: string;
  instructionContextToggles: Record<string, boolean>;
  instructionEnhanceComparison: InstructionEnhanceComparison | null;
  describeInstructionLanguage: (language: InstructionLanguage) => string;
  isSending: boolean;
  isThreadReadOnly: boolean;
  isEnhancingInstruction: boolean;
  showEnhancingInstructionSpinner: boolean;
  isSavingInstructionPrompt: boolean;
  canSaveAgentInstructionPrompt: boolean;
  canEnhanceAgentInstruction: boolean;
  canClearAgentInstruction: boolean;
  loadedInstructionFileName: string | null;
  instructionFileInputRef: RefLike<HTMLInputElement>;
  instructionFileError: string | null;
  instructionSaveError: string | null;
  instructionSaveSuccess: string | null;
  instructionEnhanceError: string | null;
  instructionEnhanceSuccess: string | null;
  onClearInstructionSaveSuccess: Callback;
  onClearInstructionEnhanceSuccess: Callback;
  onInstructionContextToggleChange: Callback;
  onAgentInstructionChange: Callback;
  onOpenInstructionFilePicker: Callback;
  onInstructionFileChange: Callback;
  onSaveInstructionPrompt: Callback;
  onEnhanceInstruction: Callback;
  onClearInstruction: Callback;
  onAdoptEnhancedInstruction: Callback;
  onAdoptOriginalInstruction: Callback;
  activeThreadOptions: ThreadListOption[];
  archivedThreadOptions: ThreadListOption[];
  activeThreadId: string;
  isLoadingThreads: boolean;
  isSwitchingThread: boolean;
  isCreatingThread: boolean;
  isDeletingThread: boolean;
  isClearingThread: boolean;
  isRestoringThread: boolean;
  threadError: string | null;
  onActiveThreadChange: Callback;
  onCreateThread: Callback;
  onThreadRename: Callback;
  onThreadCancel: Callback;
  onThreadDelete: Callback;
  onThreadClear: Callback;
  onThreadRestore: Callback;
}) {
  return {
    instructionSectionProps: {
      agentInstruction: options.agentInstruction,
      instructionContextToggleOptions: THREAD_INSTRUCTION_CONTEXT_OPTIONS.map(
        (option) => ({
          key: option.key,
          label: option.label,
          infoTitle: option.infoTitle,
          infoLines: Array.from(option.infoLines),
          enabled: options.instructionContextToggles[option.key] === true,
        }),
      ),
      instructionEnhanceComparison: options.instructionEnhanceComparison,
      describeInstructionLanguage: options.describeInstructionLanguage,
      isSending: options.isSending,
      isThreadReadOnly: options.isThreadReadOnly,
      isEnhancingInstruction: options.isEnhancingInstruction,
      showEnhancingInstructionSpinner:
        options.showEnhancingInstructionSpinner,
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
      onClearInstructionSaveSuccess: options.onClearInstructionSaveSuccess,
      onClearInstructionEnhanceSuccess:
        options.onClearInstructionEnhanceSuccess,
      onInstructionContextToggleChange:
        options.onInstructionContextToggleChange,
      onAgentInstructionChange: options.onAgentInstructionChange,
      onOpenInstructionFilePicker: options.onOpenInstructionFilePicker,
      onInstructionFileChange: options.onInstructionFileChange,
      onSaveInstructionPrompt: options.onSaveInstructionPrompt,
      onEnhanceInstruction: options.onEnhanceInstruction,
      onClearInstruction: options.onClearInstruction,
      onAdoptEnhancedInstruction: options.onAdoptEnhancedInstruction,
      onAdoptOriginalInstruction: options.onAdoptOriginalInstruction,
    },
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
    onActiveThreadChange: options.onActiveThreadChange,
    onCreateThread: options.onCreateThread,
    onThreadRename: options.onThreadRename,
    onThreadCancel: options.onThreadCancel,
    onThreadDelete: options.onThreadDelete,
    onThreadClear: options.onThreadClear,
    onThreadRestore: options.onThreadRestore,
  };
}

export function buildSkillsTabProps(options: {
  threadSkillOptions: SelectableSkillOption[];
  isLoadingSkills: boolean;
  isSending: boolean;
  isThreadReadOnly: boolean;
  skillsError: string | null;
  skillsWarning: string | null;
  onReloadSkills: Callback;
  onToggleThreadSkill: Callback;
  onClearSkillsWarning: Callback;
  skillRegistryGroups: ReturnType<typeof buildSkillRegistryGroups>;
  isMutatingSkillRegistries: boolean;
  skillRegistryError: string | null;
  skillRegistryWarning: string | null;
  skillRegistrySuccess: string | null;
  onToggleRegistrySkill: Callback;
  onClearSkillRegistryWarning: Callback;
  onClearSkillRegistrySuccess: Callback;
}) {
  return {
    skillsSectionProps: {
      skillOptions: options.threadSkillOptions,
      isLoadingSkills: options.isLoadingSkills,
      isSending: options.isSending,
      isThreadReadOnly: options.isThreadReadOnly,
      skillsError: options.skillsError,
      skillsWarning: options.skillsWarning,
      onReloadSkills: options.onReloadSkills,
      onToggleSkill: options.onToggleThreadSkill,
      onClearSkillsWarning: options.onClearSkillsWarning,
    },
    skillRegistrySectionProps: {
      skillRegistryGroups: options.skillRegistryGroups,
      isLoadingSkillRegistries: options.isLoadingSkills,
      isMutatingSkillRegistries: options.isMutatingSkillRegistries,
      skillRegistryError: options.skillRegistryError,
      skillRegistryWarning: options.skillRegistryWarning,
      skillRegistrySuccess: options.skillRegistrySuccess,
      onReloadSkillRegistries: options.onReloadSkills,
      onToggleRegistrySkill: options.onToggleRegistrySkill,
      onClearSkillRegistryWarning: options.onClearSkillRegistryWarning,
      onClearSkillRegistrySuccess: options.onClearSkillRegistrySuccess,
    },
  };
}
