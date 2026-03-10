import {
  useMemo,
} from "react";
import { CHAT_ATTACHMENT_MAX_FILES } from "~/lib/constants/chat";
import {
  createChatComposerHandlers,
} from "~/lib/client/usecase/workspace/chat-composer/handlers";
import {
  type ChatCommandProvider,
} from "~/lib/client/usecase/workspace/chat-composer/menu-state";
import {
  createPlaygroundControlHandlers,
} from "~/lib/client/usecase/workspace/playground-panel/handlers";
import {
  buildPlaygroundPanelProps,
  selectPlaygroundComposerViewModel,
  selectPlaygroundOperationLogViewModel,
} from "~/lib/client/usecase/workspace/playground-panel/selectors";
import {
  usePlaygroundRuntime,
} from "~/lib/client/usecase/workspace/playground-panel/use-playground-runtime";

type PlaygroundPanelPropsOptions = Parameters<typeof buildPlaygroundPanelProps>[0];

type WorkspacePlaygroundPanelBaseOptions = Omit<
  PlaygroundPanelPropsOptions,
  | "onCheckDesktopUpdates"
  | "onApplyDesktopUpdate"
  | "onCreateThread"
  | "onCancelThreadProcessing"
  | "onClearSystemNotice"
  | "onCompositionStart"
  | "onCompositionEnd"
  | "maxMessageAttachmentFiles"
  | "threadOperationLogsByTurnId"
  | "activeTurnOperationLogs"
  | "errorTurnOperationLogs"
  | "onCopyMessage"
  | "onCopyOperationLog"
  | "onSubmit"
  | "messageAttachmentAccept"
  | "messageAttachmentFormatHint"
  | "onDraftChange"
  | "onInputSelect"
  | "onOpenMessageAttachmentPicker"
  | "onMessageAttachmentFileChange"
  | "onRemoveMessageAttachment"
  | "onInputKeyDown"
  | "chatCommandMenu"
  | "onSelectChatCommandSuggestion"
  | "onHighlightChatCommandSuggestion"
  | "onChatAzureSelectorAction"
  | "onProjectChange"
  | "onDeploymentChange"
  | "onReasoningEffortChange"
  | "onWebSearchEnabledChange"
  | "canSendMessage"
> & {
  handleCheckDesktopUpdates: () => Promise<void> | void;
  handleApplyDesktopUpdate: () => Promise<void> | void;
  handleCreateThread: () => Promise<void> | void;
  handleThreadCancel: (threadId: string) => void;
  readActiveThreadId: () => string;
  setSystemNotice: (value: string | null) => void;
  setIsComposing: (value: boolean) => void;
};

type WorkspacePlaygroundPanelSelectionOptions =
  WorkspacePlaygroundPanelBaseOptions &
    Pick<
      PlaygroundPanelPropsOptions,
      | "threadOperationLogsByTurnId"
      | "activeTurnOperationLogs"
      | "errorTurnOperationLogs"
      | "onCopyMessage"
      | "onCopyOperationLog"
      | "onSubmit"
      | "messageAttachmentAccept"
      | "messageAttachmentFormatHint"
      | "onDraftChange"
      | "onInputSelect"
      | "onOpenMessageAttachmentPicker"
      | "onMessageAttachmentFileChange"
      | "onRemoveMessageAttachment"
      | "onInputKeyDown"
      | "chatCommandMenu"
      | "onSelectChatCommandSuggestion"
      | "onHighlightChatCommandSuggestion"
      | "onChatAzureSelectorAction"
      | "onProjectChange"
      | "onDeploymentChange"
      | "onReasoningEffortChange"
      | "onWebSearchEnabledChange"
      | "canSendMessage"
    >;

type UseWorkspacePlaygroundOptions = {
  chatCommandProviders: readonly ChatCommandProvider[];
  runtime: Omit<
    Parameters<typeof usePlaygroundRuntime>[0],
    "chatCommandProviders"
  >;
  operationLogs: Parameters<typeof selectPlaygroundOperationLogViewModel>[0];
  composerView: Parameters<typeof selectPlaygroundComposerViewModel>[0];
  composerHandlers: Omit<
    Parameters<typeof createChatComposerHandlers>[0],
    | "readDraftAttachmentTotalSizeBytes"
    | "readDraftPdfAttachmentTotalSizeBytes"
    | "chatAttachmentFormatHint"
    | "readActiveChatCommandMatch"
    | "readActiveChatCommandProvider"
    | "readActiveChatCommandSuggestions"
    | "readActiveChatCommandMenu"
    | "readActiveChatCommandHighlightIndex"
  >;
  controlHandlers: Parameters<typeof createPlaygroundControlHandlers>[0];
  panel: WorkspacePlaygroundPanelBaseOptions;
};

export function selectWorkspacePlaygroundPanelProps(
  options: WorkspacePlaygroundPanelSelectionOptions,
) {
  const {
    handleCheckDesktopUpdates,
    handleApplyDesktopUpdate,
    handleCreateThread,
    handleThreadCancel,
    readActiveThreadId,
    setSystemNotice,
    setIsComposing,
    ...panelOptions
  } = options;

  return buildPlaygroundPanelProps({
    ...panelOptions,
    onCheckDesktopUpdates: () => {
      void handleCheckDesktopUpdates();
    },
    onApplyDesktopUpdate: () => {
      void handleApplyDesktopUpdate();
    },
    onCreateThread: () => {
      void handleCreateThread();
    },
    onCancelThreadProcessing: () => {
      handleThreadCancel(readActiveThreadId());
    },
    onClearSystemNotice: () => {
      setSystemNotice(null);
    },
    onCompositionStart: () => {
      setIsComposing(true);
    },
    onCompositionEnd: () => {
      setIsComposing(false);
    },
    maxMessageAttachmentFiles: CHAT_ATTACHMENT_MAX_FILES,
  });
}

export function useWorkspacePlayground(options: UseWorkspacePlaygroundOptions) {
  const {
    activeChatCommandMatch,
    activeChatCommandProvider,
    activeChatCommandSuggestions,
    activeChatCommandHighlightIndex,
    activeChatCommandMenu,
  } = usePlaygroundRuntime({
    ...options.runtime,
    chatCommandProviders: options.chatCommandProviders,
  });

  const {
    threadOperationLogsByTurnId,
    activeTurnOperationLogs,
    errorTurnOperationLogs,
  } = useMemo(
    () => selectPlaygroundOperationLogViewModel(options.operationLogs),
    [options.operationLogs],
  );
  const {
    draftAttachmentTotalSizeBytes,
    draftPdfAttachmentTotalSizeBytes,
    messageAttachmentAccept,
    messageAttachmentFormatHint,
    canSendMessage,
  } = useMemo(
    () => selectPlaygroundComposerViewModel(options.composerView),
    [options.composerView],
  );

  const playgroundControlHandlers = useMemo(
    () => createPlaygroundControlHandlers(options.controlHandlers),
    [options.controlHandlers],
  );
  const chatComposerHandlers = useMemo(
    () =>
      createChatComposerHandlers({
        ...options.composerHandlers,
        readDraftAttachmentTotalSizeBytes: () =>
          draftAttachmentTotalSizeBytes,
        readDraftPdfAttachmentTotalSizeBytes: () =>
          draftPdfAttachmentTotalSizeBytes,
        chatAttachmentFormatHint: messageAttachmentFormatHint,
        readActiveChatCommandMatch: () => activeChatCommandMatch,
        readActiveChatCommandProvider: () => activeChatCommandProvider,
        readActiveChatCommandSuggestions: () => activeChatCommandSuggestions,
        readActiveChatCommandMenu: () => activeChatCommandMenu,
        readActiveChatCommandHighlightIndex: () =>
          activeChatCommandHighlightIndex,
      }),
    [
      activeChatCommandHighlightIndex,
      activeChatCommandMatch,
      activeChatCommandMenu,
      activeChatCommandProvider,
      activeChatCommandSuggestions,
      messageAttachmentFormatHint,
      draftAttachmentTotalSizeBytes,
      draftPdfAttachmentTotalSizeBytes,
      options.composerHandlers,
    ],
  );

  const playgroundPanelProps = useMemo(
    () =>
      selectWorkspacePlaygroundPanelProps({
        ...options.panel,
        threadOperationLogsByTurnId,
        activeTurnOperationLogs,
        errorTurnOperationLogs,
        messageAttachmentAccept,
        messageAttachmentFormatHint,
        chatCommandMenu: activeChatCommandMenu,
        onSelectChatCommandSuggestion:
          chatComposerHandlers.handleSelectActiveChatCommandSuggestion,
        onHighlightChatCommandSuggestion:
          options.runtime.setChatCommandHighlightedIndex,
        onDraftChange: chatComposerHandlers.handleDraftChange,
        onInputSelect: chatComposerHandlers.handleInputSelect,
        onOpenMessageAttachmentPicker:
          chatComposerHandlers.handleOpenChatAttachmentPicker,
        onMessageAttachmentFileChange:
          chatComposerHandlers.handleChatAttachmentFileChange,
        onRemoveMessageAttachment:
          chatComposerHandlers.handleRemoveDraftAttachment,
        onInputKeyDown: chatComposerHandlers.handleInputKeyDown,
        onSubmit: chatComposerHandlers.handleSubmit,
        onChatAzureSelectorAction:
          playgroundControlHandlers.handleChatAzureSelectorAction,
        onProjectChange: playgroundControlHandlers.handleChatProjectChange,
        onDeploymentChange:
          playgroundControlHandlers.handleChatDeploymentChange,
        onReasoningEffortChange:
          playgroundControlHandlers.handleReasoningEffortChange,
        onWebSearchEnabledChange:
          playgroundControlHandlers.handleWebSearchEnabledChange,
        onCopyMessage: playgroundControlHandlers.handleCopyMessage,
        onCopyOperationLog: playgroundControlHandlers.handleCopyMcpLog,
        canSendMessage,
      }),
    [
      activeChatCommandMenu,
      activeTurnOperationLogs,
      canSendMessage,
      chatComposerHandlers.handleChatAttachmentFileChange,
      chatComposerHandlers.handleDraftChange,
      chatComposerHandlers.handleInputKeyDown,
      chatComposerHandlers.handleInputSelect,
      chatComposerHandlers.handleOpenChatAttachmentPicker,
      chatComposerHandlers.handleRemoveDraftAttachment,
      chatComposerHandlers.handleSelectActiveChatCommandSuggestion,
      chatComposerHandlers.handleSubmit,
      errorTurnOperationLogs,
      messageAttachmentAccept,
      messageAttachmentFormatHint,
      options.panel,
      options.runtime.setChatCommandHighlightedIndex,
      playgroundControlHandlers.handleChatAzureSelectorAction,
      playgroundControlHandlers.handleChatDeploymentChange,
      playgroundControlHandlers.handleChatProjectChange,
      playgroundControlHandlers.handleCopyMcpLog,
      playgroundControlHandlers.handleCopyMessage,
      playgroundControlHandlers.handleReasoningEffortChange,
      playgroundControlHandlers.handleWebSearchEnabledChange,
      threadOperationLogsByTurnId,
    ],
  );

  return {
    playgroundPanelProps,
  };
}
