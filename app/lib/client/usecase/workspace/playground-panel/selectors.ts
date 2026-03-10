import { CHAT_ATTACHMENT_ALLOWED_EXTENSIONS } from "~/lib/constants/chat";
import type {
  AzureProjectOption,
} from "~/lib/client/usecase/workspace/azure-settings/parsers";
import type {
  DesktopUpdaterStatus,
} from "~/lib/client/infrastructure/browser/desktop-updater";
import type {
  DesktopUpdaterActionState,
} from "~/lib/client/usecase/workspace/desktop-updater/selectors";
import type {
  ChatCommandMenuView,
  ReasoningEffort,
} from "~/lib/client/usecase/workspace/view-types";
import type { DraftChatAttachment } from "~/lib/contracts/chat/attachments";
import type { ThreadMessage } from "~/lib/contracts/chat/messages";
import type { ThreadOperationLogEntry } from "~/lib/contracts/chat/operation-log";
import type { McpServerConfig } from "~/lib/contracts/mcp/profile";
import type { ThreadSkillActivation } from "~/lib/contracts/skills/types";
import { buildThreadOperationLogsByTurnId } from "~/lib/client/usecase/workspace/playground-panel/operation-log-grouping";
import { canSendMessageByGuard } from "~/lib/client/usecase/workspace/threads/thread-guards";
import type { ThreadOperationPhase } from "~/lib/client/usecase/workspace/threads/thread-operation-phase";

type Callback = (...args: any[]) => void | Promise<void>;
type RefLike<T> = { current: T | null };

function readFileExtension(fileName: string): string {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

export function selectPlaygroundOperationLogViewModel(options: {
  mcpRpcLogs: ThreadOperationLogEntry[];
  activeTurnId: string | null;
  lastErrorTurnId: string | null;
}) {
  const threadOperationLogsByTurnId = buildThreadOperationLogsByTurnId(
    options.mcpRpcLogs,
  );

  return {
    threadOperationLogsByTurnId,
    activeTurnOperationLogs: options.activeTurnId
      ? (threadOperationLogsByTurnId.get(options.activeTurnId) ?? [])
      : [],
    errorTurnOperationLogs: options.lastErrorTurnId
      ? (threadOperationLogsByTurnId.get(options.lastErrorTurnId) ?? [])
      : [],
  };
}

export function selectPlaygroundComposerViewModel(options: {
  draft: string;
  draftAttachments: DraftChatAttachment[];
  threadOperationPhase: ThreadOperationPhase;
  isSending: boolean;
  isActiveThreadArchived: boolean;
  isChatLocked: boolean;
  isLoadingAzureConnections: boolean;
  isLoadingAzureDeployments: boolean;
  hasActiveThreadId: boolean;
  hasActivePlaygroundAzureConnection: boolean;
  hasSelectedPlaygroundAzureDeploymentName: boolean;
  isSelectedPlaygroundReasoningEffortOptionAvailable: boolean;
  isPlaygroundReasoningEffortWebSearchCompatible: boolean;
}) {
  const draftAttachmentTotalSizeBytes = options.draftAttachments.reduce(
    (sum, attachment) => sum + attachment.sizeBytes,
    0,
  );
  const draftPdfAttachmentTotalSizeBytes = options.draftAttachments.reduce(
    (sum, attachment) =>
      sum +
      (readFileExtension(attachment.name) === "pdf"
        ? attachment.sizeBytes
        : 0),
    0,
  );

  return {
    draftAttachmentTotalSizeBytes,
    draftPdfAttachmentTotalSizeBytes,
    messageAttachmentAccept: [
      ...Array.from(
        CHAT_ATTACHMENT_ALLOWED_EXTENSIONS,
        (extension) => `.${extension}`,
      ),
    ].join(","),
    messageAttachmentFormatHint:
      "Code Interpreter supported files (.pdf, .csv, .xlsx, .docx, .png, ...)",
    canSendMessage: canSendMessageByGuard({
      threadOperationPhase: options.threadOperationPhase,
      isSending: options.isSending,
      isActiveThreadArchived: options.isActiveThreadArchived,
      isChatLocked: options.isChatLocked,
      isLoadingAzureConnections: options.isLoadingAzureConnections,
      isLoadingPlaygroundAzureDeployments: options.isLoadingAzureDeployments,
      hasActiveThreadId: options.hasActiveThreadId,
      hasActivePlaygroundAzureConnection:
        options.hasActivePlaygroundAzureConnection,
      hasSelectedPlaygroundAzureDeploymentName:
        options.hasSelectedPlaygroundAzureDeploymentName,
      isSelectedPlaygroundReasoningEffortOptionAvailable:
        options.isSelectedPlaygroundReasoningEffortOptionAvailable,
      isPlaygroundReasoningEffortWebSearchCompatible:
        options.isPlaygroundReasoningEffortWebSearchCompatible,
      hasDraftContent: options.draft.trim().length > 0,
    }),
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
