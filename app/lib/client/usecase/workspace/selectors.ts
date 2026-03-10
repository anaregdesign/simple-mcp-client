import type {
  AzurePrincipalProfile,
  AzureProjectOption,
  AzureTenantOption,
} from "~/lib/client/usecase/workspace/azure-parsers";
import type { DraftChatAttachment } from "~/lib/contracts/chat/attachments";
import type { ThreadMessage } from "~/lib/contracts/chat/messages";
import type { ThreadOperationLogEntry } from "~/lib/contracts/chat/operation-log";
import {
  type WorkspaceMcpServerProfileOption,
} from "~/lib/client/usecase/workspace/mcp-profiles/selectors";
import type {
  ChatCommandMenuView,
  InstructionLanguage,
  McpTransport,
  ReasoningEffort,
  ThemeMode,
} from "~/lib/client/usecase/workspace/view-types";
import type {
  DesktopUpdaterActionState,
  DesktopUpdaterStatus,
} from "~/lib/client/usecase/workspace/desktop-updater/runtime";
import type { ThreadListOption } from "~/lib/client/usecase/workspace/threads/thread-runtime";
import type { InstructionEnhanceComparison } from "~/lib/client/usecase/workspace/types";
import {
  THREAD_INSTRUCTION_CONTEXT_OPTIONS,
} from "~/lib/contracts/threads/instruction-context";
import type { McpServerConfig } from "~/lib/contracts/mcp/profile";
import {
  readSkillRegistryLabelFromSkillLocation,
  readSkillRegistryOptionById,
  SKILL_REGISTRY_OPTIONS,
} from "~/lib/contracts/skills/registry";
import type {
  SkillCatalogEntry,
  SkillRegistryCatalog,
  ThreadSkillActivation,
} from "~/lib/contracts/skills/types";

type Callback = (...args: any[]) => void | Promise<void>;
type RefLike<T> = { current: T | null };

export type ChatCommandSuggestion = {
  id: string;
  label: string;
  description: string;
  detail: string;
  isSelected: boolean;
  isAvailable: boolean;
};

type SelectableSkillOption = {
  name: string;
  description: string;
  location: string;
  source: SkillCatalogEntry["source"] | "app_data";
  badge: string;
  isSelected: boolean;
  isAvailable: boolean;
};

export function buildThreadSkillOptions(options: {
  availableSkills: SkillCatalogEntry[];
  selectedThreadSkills: ThreadSkillActivation[];
}): SelectableSkillOption[] {
  return buildSelectableSkillOptions({
    availableSkills: options.availableSkills,
    selectedSkills: options.selectedThreadSkills,
    unavailableDescription:
      "Saved for this thread, but the SKILL.md file is currently unavailable.",
  });
}

export function buildMessageSkillActivationOptions(options: {
  availableSkills: SkillCatalogEntry[];
  selectedMessageSkillActivations: ThreadSkillActivation[];
}): SelectableSkillOption[] {
  return buildSelectableSkillOptions({
    availableSkills: options.availableSkills,
    selectedSkills: options.selectedMessageSkillActivations,
    unavailableDescription:
      "Added for this message, but the SKILL.md file is currently unavailable.",
  });
}

export function buildSkillRegistryGroups(
  skillRegistryCatalogs: SkillRegistryCatalog[],
) {
  if (skillRegistryCatalogs.length > 0) {
    return skillRegistryCatalogs.map((registry) => ({
      registryUrl:
        readSkillRegistryOptionById(registry.registryId)?.sourceUrl ??
        registry.repositoryUrl,
      registryId: registry.registryId,
      label: registry.registryLabel,
      description: registry.registryDescription,
      skillCount: registry.skills.length,
      installedCount: registry.skills.filter((skill) => skill.isInstalled)
        .length,
      skills: [...registry.skills]
        .sort((left, right) => {
          if (left.isInstalled !== right.isInstalled) {
            return left.isInstalled ? -1 : 1;
          }

          const byTag = (left.tag ?? "").localeCompare(right.tag ?? "");
          if (byTag !== 0) {
            return byTag;
          }

          return left.name.localeCompare(right.name);
        })
        .map((skill) => ({
          id: skill.id,
          name: skill.name,
          description: skill.description,
          detail: skill.isInstalled
            ? `${skill.tag ? `Tag: ${skill.tag} · ` : ""}${
                skill.isUpdateAvailable ? "Update available · " : ""
              }Installed: ${skill.installLocation}`
            : `${skill.tag ? `Tag: ${skill.tag} · ` : ""}Source: ${
                skill.remotePath
              }`,
          isInstalled: skill.isInstalled,
          isUpdateAvailable: skill.isUpdateAvailable,
        })),
    }));
  }

  return SKILL_REGISTRY_OPTIONS.map((registry) => ({
    registryUrl: registry.sourceUrl,
    registryId: registry.id,
    label: registry.label,
    description: registry.description,
    skillCount: 0,
    installedCount: 0,
    skills: [],
  }));
}

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
      selectedUtilityAzureConnectionId: options.selectedUtilityAzureConnectionId,
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

export function buildPlaygroundPanelProps(options: {
  messages: ThreadMessage[];
  threadOperationLogsByTurnId: Map<string, ThreadOperationLogEntry[]>;
  isSending: boolean;
  isThreadReadOnly: boolean;
  desktopUpdaterStatus: DesktopUpdaterStatus;
  desktopUpdaterActionState: DesktopUpdaterActionState;
  isApplyingDesktopUpdate: boolean;
  onCheckDesktopUpdates: Callback;
  onApplyDesktopUpdate: Callback;
  activeThreadName: string;
  isThreadOperationBusy: boolean;
  isCreatingThread: boolean;
  onCreateThread: Callback;
  onCancelThreadProcessing: Callback;
  onCopyMessage: (content: string) => void;
  onCopyOperationLog: (content: string) => void;
  sendProgressMessages: string[];
  activeTurnOperationLogs: ThreadOperationLogEntry[];
  errorTurnOperationLogs: ThreadOperationLogEntry[];
  endOfMessagesRef: RefLike<HTMLDivElement>;
  systemNotice: string | null;
  onClearSystemNotice: Callback;
  error: string | null;
  azureLoginError: string | null;
  onSubmit: Callback;
  chatInputRef: RefLike<HTMLTextAreaElement>;
  messageAttachmentInputRef: RefLike<HTMLInputElement>;
  messageAttachmentAccept: string;
  messageAttachmentFormatHint: string;
  draft: string;
  messageAttachments: DraftChatAttachment[];
  messageAttachmentError: string | null;
  onDraftChange: Callback;
  onInputSelect: Callback;
  onOpenMessageAttachmentPicker: Callback;
  onMessageAttachmentFileChange: Callback;
  onRemoveMessageAttachment: (id: string) => void;
  onInputKeyDown: Callback;
  chatCommandMenu: ChatCommandMenuView | null;
  onSelectChatCommandSuggestion: (id: string) => void;
  onHighlightChatCommandSuggestion: (index: number) => void;
  onCompositionStart: Callback;
  onCompositionEnd: Callback;
  isChatLocked: boolean;
  isLoadingAzureConnections: boolean;
  isLoadingAzureDeployments: boolean;
  isAzureAuthRequired: boolean;
  isStartingAzureLogin: boolean;
  isStartingAzureLogout: boolean;
  onChatAzureSelectorAction: (target: "project" | "deployment") => void;
  azureConnections: AzureProjectOption[];
  activeAzureConnectionId: string;
  onProjectChange: (projectId: string) => void;
  selectedAzureDeploymentName: string;
  azureDeployments: string[];
  onDeploymentChange: (deploymentName: string) => void;
  reasoningEffort: ReasoningEffort;
  reasoningEffortOptions: ReasoningEffort[];
  isReasoningEffortSupported: boolean;
  onReasoningEffortChange: (value: ReasoningEffort) => void;
  webSearchEnabled: boolean;
  onWebSearchEnabledChange: (value: boolean) => void;
  maxMessageAttachmentFiles: number;
  canSendMessage: boolean;
  selectedThreadSkills: ThreadSkillActivation[];
  selectedMessageSkillActivations: ThreadSkillActivation[];
  onRemoveThreadSkill: (location: string) => void;
  onRemoveMessageSkillActivation: (location: string) => void;
  mcpServers: McpServerConfig[];
  onRemoveMcpServer: (id: string) => void;
}) {
  return {
    messages: options.messages,
    threadOperationLogsByTurnId: options.threadOperationLogsByTurnId,
    isSending: options.isSending,
    isThreadReadOnly: options.isThreadReadOnly,
    desktopUpdaterStatus: options.desktopUpdaterStatus,
    desktopUpdaterActionState: options.desktopUpdaterActionState,
    isApplyingDesktopUpdate: options.isApplyingDesktopUpdate,
    onCheckDesktopUpdates: options.onCheckDesktopUpdates,
    onApplyDesktopUpdate: options.onApplyDesktopUpdate,
    activeThreadName: options.activeThreadName,
    isThreadOperationBusy: options.isThreadOperationBusy,
    isCreatingThread: options.isCreatingThread,
    onCreateThread: options.onCreateThread,
    onCancelThreadProcessing: options.onCancelThreadProcessing,
    onCopyMessage: options.onCopyMessage,
    onCopyOperationLog: options.onCopyOperationLog,
    sendProgressMessages: options.sendProgressMessages,
    activeTurnOperationLogs: options.activeTurnOperationLogs,
    errorTurnOperationLogs: options.errorTurnOperationLogs,
    endOfMessagesRef: options.endOfMessagesRef,
    systemNotice: options.systemNotice,
    onClearSystemNotice: options.onClearSystemNotice,
    error: options.error,
    azureLoginError: options.azureLoginError,
    onSubmit: options.onSubmit,
    chatInputRef: options.chatInputRef,
    messageAttachmentInputRef: options.messageAttachmentInputRef,
    messageAttachmentAccept: options.messageAttachmentAccept,
    messageAttachmentFormatHint: options.messageAttachmentFormatHint,
    draft: options.draft,
    messageAttachments: options.messageAttachments,
    messageAttachmentError: options.messageAttachmentError,
    onDraftChange: options.onDraftChange,
    onInputSelect: options.onInputSelect,
    onOpenMessageAttachmentPicker: options.onOpenMessageAttachmentPicker,
    onMessageAttachmentFileChange: options.onMessageAttachmentFileChange,
    onRemoveMessageAttachment: options.onRemoveMessageAttachment,
    onInputKeyDown: options.onInputKeyDown,
    chatCommandMenu: options.chatCommandMenu,
    onSelectChatCommandSuggestion: options.onSelectChatCommandSuggestion,
    onHighlightChatCommandSuggestion:
      options.onHighlightChatCommandSuggestion,
    onCompositionStart: options.onCompositionStart,
    onCompositionEnd: options.onCompositionEnd,
    isChatLocked: options.isChatLocked,
    isLoadingAzureConnections: options.isLoadingAzureConnections,
    isLoadingAzureDeployments: options.isLoadingAzureDeployments,
    isAzureAuthRequired: options.isAzureAuthRequired,
    isStartingAzureLogin: options.isStartingAzureLogin,
    isStartingAzureLogout: options.isStartingAzureLogout,
    onChatAzureSelectorAction: options.onChatAzureSelectorAction,
    azureConnections: options.azureConnections,
    activeAzureConnectionId: options.activeAzureConnectionId,
    onProjectChange: options.onProjectChange,
    selectedAzureDeploymentName: options.selectedAzureDeploymentName,
    azureDeployments: options.azureDeployments,
    onDeploymentChange: options.onDeploymentChange,
    reasoningEffort: options.reasoningEffort,
    reasoningEffortOptions: options.reasoningEffortOptions,
    isReasoningEffortSupported: options.isReasoningEffortSupported,
    onReasoningEffortChange: options.onReasoningEffortChange,
    webSearchEnabled: options.webSearchEnabled,
    onWebSearchEnabledChange: options.onWebSearchEnabledChange,
    maxMessageAttachmentFiles: options.maxMessageAttachmentFiles,
    canSendMessage: options.canSendMessage,
    selectedThreadSkills: options.selectedThreadSkills,
    selectedMessageSkillActivations: options.selectedMessageSkillActivations,
    onRemoveThreadSkill: options.onRemoveThreadSkill,
    onRemoveMessageSkillActivation: options.onRemoveMessageSkillActivation,
    mcpServers: options.mcpServers,
    onRemoveMcpServer: options.onRemoveMcpServer,
  };
}

export function buildUnauthenticatedPanelProps(options: {
  isStartingAzureLogin: boolean;
  onAzureLogin: Callback;
}) {
  return {
    isStartingAzureLogin: options.isStartingAzureLogin,
    onAzureLogin: options.onAzureLogin,
  };
}

export function readSkillCommandSuggestions(
  skillOptions: SelectableSkillOption[],
  queryRaw: string,
): ChatCommandSuggestion[] {
  const query = queryRaw.trim().toLowerCase();
  const maxSuggestions = 12;

  return skillOptions
    .filter((skill) => {
      if (!skill.isAvailable) {
        return false;
      }

      if (!query) {
        return true;
      }

      return (
        skill.name.toLowerCase().includes(query) ||
        skill.description.toLowerCase().includes(query) ||
        skill.location.toLowerCase().includes(query)
      );
    })
    .slice(0, maxSuggestions)
    .map((skill) => ({
      id: skill.location,
      label: skill.name,
      description: skill.description,
      detail: `${skill.badge} · ${skill.location}`,
      isSelected: skill.isSelected,
      isAvailable: skill.isAvailable,
    }));
}

export function resolveSkillBadgeLabel(
  source: SkillCatalogEntry["source"] | "app_data",
  location: string,
): string {
  if (source === "workspace") {
    return "Workspace";
  }

  if (source === "codex_home") {
    return "CODEX_HOME";
  }

  const registryLabel = readSkillRegistryLabelFromSkillLocation(location);
  return registryLabel ?? "App Data";
}

function buildSelectableSkillOptions(options: {
  availableSkills: SkillCatalogEntry[];
  selectedSkills: ThreadSkillActivation[];
  unavailableDescription: string;
}): SelectableSkillOption[] {
  const availableSkillLocationSet = new Set(
    options.availableSkills.map((skill) => skill.location),
  );
  const selectedSkillLocationSet = new Set(
    options.selectedSkills.map((selection) => selection.location),
  );

  return [
    ...options.availableSkills.map((skill) => ({
      name: skill.name,
      description: skill.description,
      location: skill.location,
      source: skill.source,
      badge: resolveSkillBadgeLabel(skill.source, skill.location),
      isSelected: selectedSkillLocationSet.has(skill.location),
      isAvailable: true,
    })),
    ...options.selectedSkills
      .filter((selection) => !availableSkillLocationSet.has(selection.location))
      .map((selection) => ({
        name: selection.name,
        description: options.unavailableDescription,
        location: selection.location,
        source: "app_data" as const,
        badge: resolveSkillBadgeLabel("app_data", selection.location),
        isSelected: true,
        isAvailable: false,
      })),
  ].sort((left, right) => {
    if (left.isSelected !== right.isSelected) {
      return left.isSelected ? -1 : 1;
    }

    return left.name.localeCompare(right.name);
  });
}
