import type {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  RefObject,
  SyntheticEvent,
} from "react";
import { CopyableAutoDismissStatusMessageList } from "~/components/CopyableAutoDismissStatusMessageList";
import { CopyableStatusMessageList } from "~/components/CopyableStatusMessageList";
import { PlaygroundAddedSkillAndMcpBubbles } from "~/components/playground/PlaygroundAddedSkillAndMcpBubbles";
import { PlaygroundChatCommandMenu } from "~/components/playground/PlaygroundChatCommandMenu";
import { PlaygroundDraftAttachmentBubbles } from "~/components/playground/PlaygroundDraftAttachmentBubbles";
import { PlaygroundQuickControls } from "~/components/playground/PlaygroundQuickControls";
import { FluentUI } from "~/components/shared/fluent";
import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";
import type {
  AzureConnectionOptionView,
  ChatCommandMenuView,
  ThreadMcpConnectionView,
  ThreadMessageAttachmentView,
  ThreadSkillView,
} from "~/lib/client/usecase/workspace/view-types";

const { Textarea } = FluentUI;

type PlaygroundComposerProps<TMcpServer extends ThreadMcpConnectionView> = {
  systemNotice: string | null;
  onClearSystemNotice: () => void;
  error: string | null;
  azureLoginError: string | null;
  isThreadReadOnly: boolean;
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
  isSending: boolean;
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
  onCancelThreadProcessing: () => void;
};

export function PlaygroundComposer<TMcpServer extends ThreadMcpConnectionView>({
  systemNotice,
  onClearSystemNotice,
  error,
  azureLoginError,
  isThreadReadOnly,
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
  isSending,
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
  onCancelThreadProcessing,
}: PlaygroundComposerProps<TMcpServer>) {
  const chatCommandListboxId = "chat-command-listbox";
  const activeChatCommandOptionId =
    chatCommandMenu && chatCommandMenu.suggestions.length > 0
      ? `chat-command-option-${chatCommandMenu.highlightedIndex}`
      : undefined;
  const isComposerReadOnly = isSending || isChatLocked || isThreadReadOnly;

  return (
    <footer className="chat-footer">
      <CopyableAutoDismissStatusMessageList
        className="chat-error-stack"
        messages={[
          {
            intent: "success",
            title: "System",
            text: systemNotice,
            onClear: onClearSystemNotice,
          },
        ]}
      />
      {error || azureLoginError || messageAttachmentError || isThreadReadOnly ? (
        <CopyableStatusMessageList
          className="chat-error-stack"
          messages={[
            {
              intent: "warning",
              title: "Archive",
              text: isThreadReadOnly
                ? "This thread is archived and read-only. Restore it from Archives to edit or send messages."
                : null,
            },
            { intent: "error", title: "Request failed", text: error },
            { intent: "error", text: azureLoginError },
            {
              intent: "error",
              title: "Attachment",
              text: messageAttachmentError,
            },
          ]}
        />
      ) : null}
      <form className="chat-form" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor="chat-input">
          Message
        </label>
        <input
          ref={messageAttachmentInputRef}
          id="chat-attachment-input"
          className="file-input-hidden"
          type="file"
          accept={messageAttachmentAccept}
          multiple
          onChange={onMessageAttachmentFileChange}
          disabled={isSending || isChatLocked || isThreadReadOnly}
        />
        <div className="chat-composer">
          <Textarea
            id="chat-input"
            name="message"
            rows={2}
            resize="none"
            ref={chatInputRef}
            className="chat-composer-input"
            placeholder="Type a message..."
            title="Message input. Enter sends, Shift+Enter inserts a new line."
            aria-haspopup={chatCommandMenu ? "listbox" : undefined}
            aria-expanded={chatCommandMenu ? true : undefined}
            aria-controls={chatCommandMenu ? chatCommandListboxId : undefined}
            aria-activedescendant={activeChatCommandOptionId}
            value={draft}
            onChange={(event, data) => {
              onDraftChange(event, data.value);
            }}
            onSelect={onInputSelect}
            onKeyDown={onInputKeyDown}
            onCompositionStart={onCompositionStart}
            onCompositionEnd={onCompositionEnd}
            readOnly={isComposerReadOnly}
            aria-disabled={isComposerReadOnly}
          />
          <PlaygroundChatCommandMenu
            chatCommandMenu={chatCommandMenu}
            chatCommandListboxId={chatCommandListboxId}
            onSelectChatCommandSuggestion={onSelectChatCommandSuggestion}
            onHighlightChatCommandSuggestion={onHighlightChatCommandSuggestion}
          />
          <PlaygroundQuickControls
            isSending={isSending}
            isChatLocked={isChatLocked}
            isThreadReadOnly={isThreadReadOnly}
            onOpenMessageAttachmentPicker={onOpenMessageAttachmentPicker}
            maxMessageAttachmentFiles={maxMessageAttachmentFiles}
            messageAttachmentFormatHint={messageAttachmentFormatHint}
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
            canSendMessage={canSendMessage}
            onCancelThreadProcessing={onCancelThreadProcessing}
          />
        </div>
      </form>
      <div className="chat-footer-draft-meta">
        <PlaygroundDraftAttachmentBubbles
          messageAttachments={messageAttachments}
          isSending={isSending}
          isThreadReadOnly={isThreadReadOnly}
          onRemoveMessageAttachment={onRemoveMessageAttachment}
        />
        <PlaygroundAddedSkillAndMcpBubbles
          selectedThreadSkills={selectedThreadSkills}
          selectedMessageSkillActivations={selectedMessageSkillActivations}
          mcpServers={mcpServers}
          isSending={isSending}
          isThreadReadOnly={isThreadReadOnly}
          onRemoveThreadSkill={onRemoveThreadSkill}
          onRemoveMessageSkillActivation={onRemoveMessageSkillActivation}
          onRemoveMcpServer={onRemoveMcpServer}
        />
      </div>
    </footer>
  );
}
