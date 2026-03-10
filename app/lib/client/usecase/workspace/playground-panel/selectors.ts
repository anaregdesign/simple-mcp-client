import type {
  AzureProjectOption,
} from "~/lib/client/usecase/workspace/azure-settings/parsers";
import type {
  DesktopUpdaterActionState,
  DesktopUpdaterStatus,
} from "~/lib/client/usecase/workspace/desktop-updater/runtime";
import type {
  ChatCommandMenuView,
  ReasoningEffort,
} from "~/lib/client/usecase/workspace/view-types";
import type { DraftChatAttachment } from "~/lib/contracts/chat/attachments";
import type { ThreadMessage } from "~/lib/contracts/chat/messages";
import type { ThreadOperationLogEntry } from "~/lib/contracts/chat/operation-log";
import type { McpServerConfig } from "~/lib/contracts/mcp/profile";
import type { ThreadSkillActivation } from "~/lib/contracts/skills/types";

type Callback = (...args: any[]) => void | Promise<void>;
type RefLike<T> = { current: T | null };

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
