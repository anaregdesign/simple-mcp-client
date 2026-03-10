/**
 * Client UI component module.
 */
import type {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  ReactNode,
  RefObject,
  SyntheticEvent,
} from "react";
import { PlaygroundComposer } from "~/components/playground/PlaygroundComposer";
import { PlaygroundConversation } from "~/components/playground/PlaygroundConversation";
import { PlaygroundHeader } from "~/components/playground/PlaygroundHeader";
import type {
  AzureConnectionOptionView,
  ChatCommandMenuView,
  DesktopUpdaterActionStateView,
  DesktopUpdaterStatusView,
  ReasoningEffort,
  ThreadMcpConnectionView,
  ThreadMessageAttachmentView,
  ThreadMessageView,
  ThreadOperationLogEntryView,
  ThreadSkillView,
} from "~/lib/client/usecase/workspace/view-types";

type PlaygroundPanelProps<
  TMessage extends ThreadMessageView,
  TThreadOperationLogEntry extends ThreadOperationLogEntryView,
  TMcpServer extends ThreadMcpConnectionView,
> = {
  messages: TMessage[];
  threadOperationLogsByTurnId: Map<string, TThreadOperationLogEntry[]>;
  isSending: boolean;
  isThreadReadOnly: boolean;
  desktopUpdaterStatus: DesktopUpdaterStatusView;
  desktopUpdaterActionState: DesktopUpdaterActionStateView;
  isApplyingDesktopUpdate: boolean;
  onCheckDesktopUpdates: () => void;
  onApplyDesktopUpdate: () => void;
  activeThreadName: string;
  isThreadOperationBusy: boolean;
  isCreatingThread: boolean;
  renderMessageContent: (
    message: TMessage,
    onCopyText: (content: string) => void,
  ) => ReactNode;
  renderTurnOperationLog: (
    entries: TThreadOperationLogEntry[],
    isLive: boolean,
    onCopy: (text: string) => void,
  ) => ReactNode;
  onCreateThread: () => void;
  onCancelThreadProcessing: () => void;
  onCopyMessage: (content: string) => void;
  onCopyOperationLog: (content: string) => void;
  sendProgressMessages: string[];
  activeTurnOperationLogs: TThreadOperationLogEntry[];
  errorTurnOperationLogs: TThreadOperationLogEntry[];
  endOfMessagesRef: RefObject<HTMLDivElement | null>;
  systemNotice: string | null;
  onClearSystemNotice: () => void;
  error: string | null;
  azureLoginError: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  chatInputRef: RefObject<HTMLTextAreaElement | null>;
  messageAttachmentInputRef: RefObject<HTMLInputElement | null>;
  messageAttachmentAccept: string;
  messageAttachmentFormatHint: string;
  draft: string;
  messageAttachments: ThreadMessageAttachmentView[];
  messageAttachmentError: string | null;
  onDraftChange: (
    event: ChangeEvent<HTMLTextAreaElement>,
    value: string,
  ) => void;
  onInputSelect: (event: SyntheticEvent<HTMLTextAreaElement>) => void;
  onOpenMessageAttachmentPicker: () => void;
  onMessageAttachmentFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveMessageAttachment: (id: string) => void;
  onInputKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  chatCommandMenu: ChatCommandMenuView | null;
  onSelectChatCommandSuggestion: (id: string) => void;
  onHighlightChatCommandSuggestion: (index: number) => void;
  onCompositionStart: () => void;
  onCompositionEnd: () => void;
  isChatLocked: boolean;
  isLoadingAzureConnections: boolean;
  isLoadingAzureDeployments: boolean;
  isAzureAuthRequired: boolean;
  isStartingAzureLogin: boolean;
  isStartingAzureLogout: boolean;
  onChatAzureSelectorAction: (target: "project" | "deployment") => void;
  azureConnections: AzureConnectionOptionView[];
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
  selectedThreadSkills: ThreadSkillView[];
  selectedMessageSkillActivations: ThreadSkillView[];
  onRemoveThreadSkill: (location: string) => void;
  onRemoveMessageSkillActivation: (location: string) => void;
  mcpServers: TMcpServer[];
  onRemoveMcpServer: (id: string) => void;
};

export function PlaygroundPanel<
  TMessage extends ThreadMessageView,
  TThreadOperationLogEntry extends ThreadOperationLogEntryView,
  TMcpServer extends ThreadMcpConnectionView,
>(props: PlaygroundPanelProps<TMessage, TThreadOperationLogEntry, TMcpServer>) {
  const {
    messages,
    threadOperationLogsByTurnId,
    isSending,
    isThreadReadOnly,
    desktopUpdaterStatus,
    desktopUpdaterActionState,
    isApplyingDesktopUpdate,
    onCheckDesktopUpdates,
    onApplyDesktopUpdate,
    activeThreadName,
    isThreadOperationBusy,
    isCreatingThread,
    renderMessageContent,
    renderTurnOperationLog,
    onCreateThread,
    onCancelThreadProcessing,
    onCopyMessage,
    onCopyOperationLog,
    sendProgressMessages,
    activeTurnOperationLogs,
    errorTurnOperationLogs,
    endOfMessagesRef,
    systemNotice,
    onClearSystemNotice,
    error,
    azureLoginError,
    onSubmit,
    chatInputRef,
    messageAttachmentInputRef,
    messageAttachmentAccept,
    messageAttachmentFormatHint,
    draft,
    messageAttachments,
    messageAttachmentError,
    onDraftChange,
    onInputSelect,
    onOpenMessageAttachmentPicker,
    onMessageAttachmentFileChange,
    onRemoveMessageAttachment,
    onInputKeyDown,
    chatCommandMenu,
    onSelectChatCommandSuggestion,
    onHighlightChatCommandSuggestion,
    onCompositionStart,
    onCompositionEnd,
    isChatLocked,
    isLoadingAzureConnections,
    isLoadingAzureDeployments,
    isAzureAuthRequired,
    isStartingAzureLogin,
    isStartingAzureLogout,
    onChatAzureSelectorAction,
    azureConnections,
    activeAzureConnectionId,
    onProjectChange,
    selectedAzureDeploymentName,
    azureDeployments,
    onDeploymentChange,
    reasoningEffort,
    reasoningEffortOptions,
    isReasoningEffortSupported,
    onReasoningEffortChange,
    webSearchEnabled,
    onWebSearchEnabledChange,
    maxMessageAttachmentFiles,
    canSendMessage,
    selectedThreadSkills,
    selectedMessageSkillActivations,
    onRemoveThreadSkill,
    onRemoveMessageSkillActivation,
    mcpServers,
  onRemoveMcpServer,
  } = props;

  return (
    <section className="chat-shell main-panel" aria-label="Playground">
      <PlaygroundHeader
        desktopUpdaterStatus={desktopUpdaterStatus}
        desktopUpdaterActionState={desktopUpdaterActionState}
        isApplyingDesktopUpdate={isApplyingDesktopUpdate}
        onCheckDesktopUpdates={onCheckDesktopUpdates}
        onApplyDesktopUpdate={onApplyDesktopUpdate}
        activeThreadName={activeThreadName}
        isThreadOperationBusy={isThreadOperationBusy}
        isCreatingThread={isCreatingThread}
        onCreateThread={onCreateThread}
      />
      <PlaygroundConversation
        messages={messages}
        threadOperationLogsByTurnId={threadOperationLogsByTurnId}
        renderMessageContent={renderMessageContent}
        renderTurnOperationLog={renderTurnOperationLog}
        onCopyMessage={onCopyMessage}
        onCopyOperationLog={onCopyOperationLog}
        isSending={isSending}
        sendProgressMessages={sendProgressMessages}
        activeTurnOperationLogs={activeTurnOperationLogs}
        errorTurnOperationLogs={errorTurnOperationLogs}
        endOfMessagesRef={endOfMessagesRef}
      />
      <PlaygroundComposer
        systemNotice={systemNotice}
        onClearSystemNotice={onClearSystemNotice}
        error={error}
        azureLoginError={azureLoginError}
        isThreadReadOnly={isThreadReadOnly}
        onSubmit={onSubmit}
        chatInputRef={chatInputRef}
        messageAttachmentInputRef={messageAttachmentInputRef}
        messageAttachmentAccept={messageAttachmentAccept}
        messageAttachmentFormatHint={messageAttachmentFormatHint}
        draft={draft}
        messageAttachments={messageAttachments}
        messageAttachmentError={messageAttachmentError}
        onDraftChange={onDraftChange}
        onInputSelect={onInputSelect}
        onOpenMessageAttachmentPicker={onOpenMessageAttachmentPicker}
        onMessageAttachmentFileChange={onMessageAttachmentFileChange}
        onRemoveMessageAttachment={onRemoveMessageAttachment}
        onInputKeyDown={onInputKeyDown}
        chatCommandMenu={chatCommandMenu}
        onSelectChatCommandSuggestion={onSelectChatCommandSuggestion}
        onHighlightChatCommandSuggestion={onHighlightChatCommandSuggestion}
        onCompositionStart={onCompositionStart}
        onCompositionEnd={onCompositionEnd}
        isSending={isSending}
        isChatLocked={isChatLocked}
        isLoadingAzureConnections={isLoadingAzureConnections}
        isLoadingAzureDeployments={isLoadingAzureDeployments}
        isAzureAuthRequired={isAzureAuthRequired}
        isStartingAzureLogin={isStartingAzureLogin}
        isStartingAzureLogout={isStartingAzureLogout}
        onChatAzureSelectorAction={onChatAzureSelectorAction}
        azureConnections={azureConnections}
        activeAzureConnectionId={activeAzureConnectionId}
        onProjectChange={onProjectChange}
        selectedAzureDeploymentName={selectedAzureDeploymentName}
        azureDeployments={azureDeployments}
        onDeploymentChange={onDeploymentChange}
        reasoningEffort={reasoningEffort}
        reasoningEffortOptions={reasoningEffortOptions}
        isReasoningEffortSupported={isReasoningEffortSupported}
        onReasoningEffortChange={onReasoningEffortChange}
        webSearchEnabled={webSearchEnabled}
        onWebSearchEnabledChange={onWebSearchEnabledChange}
        maxMessageAttachmentFiles={maxMessageAttachmentFiles}
        canSendMessage={canSendMessage}
        selectedThreadSkills={selectedThreadSkills}
        selectedMessageSkillActivations={selectedMessageSkillActivations}
        onRemoveThreadSkill={onRemoveThreadSkill}
        onRemoveMessageSkillActivation={onRemoveMessageSkillActivation}
        mcpServers={mcpServers}
        onRemoveMcpServer={onRemoveMcpServer}
        onCancelThreadProcessing={onCancelThreadProcessing}
      />
    </section>
  );
}
