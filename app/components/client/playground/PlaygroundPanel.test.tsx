/**
 * Test module verifying chat composer lock rendering behavior.
 */
import React, { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SSRProvider } from "@fluentui/react-components";
import { describe, expect, it } from "vitest";
import { getDefaultDesktopUpdaterStatus } from "~/lib/client/controller/desktop-updater";
import { PlaygroundPanel } from "./PlaygroundPanel";

function renderPlaygroundPanelMarkup(options: {
  isChatLocked: boolean;
  isSending?: boolean;
  isThreadReadOnly?: boolean;
}) {
  return renderToStaticMarkup(
    <SSRProvider>
      <PlaygroundPanel
        messages={[]}
        threadOperationLogsByTurnId={new Map()}
        isSending={options.isSending ?? false}
        isThreadReadOnly={options.isThreadReadOnly ?? false}
        desktopUpdaterStatus={getDefaultDesktopUpdaterStatus()}
        isApplyingDesktopUpdate={false}
        onCheckDesktopUpdates={() => undefined}
        onApplyDesktopUpdate={() => undefined}
        activeThreadName="Thread"
        isThreadOperationBusy={false}
        isCreatingThread={false}
        renderMessageContent={() => null}
        renderTurnOperationLog={() => null}
        onCreateThread={() => undefined}
        onCancelThreadProcessing={() => undefined}
        onCopyMessage={() => undefined}
        onCopyOperationLog={() => undefined}
        sendProgressMessages={[]}
        activeTurnOperationLogs={[]}
        errorTurnOperationLogs={[]}
        endOfMessagesRef={createRef<HTMLDivElement>()}
        systemNotice={null}
        onClearSystemNotice={() => undefined}
        error={null}
        azureLoginError={null}
        onSubmit={() => undefined}
        chatInputRef={createRef<HTMLTextAreaElement>()}
        messageAttachmentInputRef={createRef<HTMLInputElement>()}
        messageAttachmentAccept=".txt"
        messageAttachmentFormatHint=".txt"
        draft=""
        messageAttachments={[]}
        messageAttachmentError={null}
        onDraftChange={() => undefined}
        onInputSelect={() => undefined}
        onOpenMessageAttachmentPicker={() => undefined}
        onMessageAttachmentFileChange={() => undefined}
        onRemoveMessageAttachment={() => undefined}
        onInputKeyDown={() => undefined}
        chatCommandMenu={null}
        onSelectChatCommandSuggestion={() => undefined}
        onHighlightChatCommandSuggestion={() => undefined}
        onCompositionStart={() => undefined}
        onCompositionEnd={() => undefined}
        isChatLocked={options.isChatLocked}
        isLoadingAzureConnections={false}
        isLoadingAzureDeployments={false}
        isAzureAuthRequired={options.isChatLocked}
        isStartingAzureLogin={false}
        isStartingAzureLogout={false}
        onChatAzureSelectorAction={() => undefined}
        azureConnections={[]}
        activeAzureConnectionId=""
        onProjectChange={() => undefined}
        selectedAzureDeploymentName=""
        azureDeployments={[]}
        onDeploymentChange={() => undefined}
        reasoningEffort="none"
        reasoningEffortOptions={["none"]}
        isReasoningEffortSupported={true}
        onReasoningEffortChange={() => undefined}
        webSearchEnabled={false}
        onWebSearchEnabledChange={() => undefined}
        maxMessageAttachmentFiles={5}
        canSendMessage={false}
        selectedThreadSkills={[]}
        selectedMessageSkillActivations={[]}
        onRemoveThreadSkill={() => undefined}
        onRemoveMessageSkillActivation={() => undefined}
        mcpServers={[]}
        onRemoveMcpServer={() => undefined}
      />
    </SSRProvider>,
  );
}

describe("PlaygroundPanel", () => {
  it("renders the chat composer as readOnly instead of disabled when chat is locked", () => {
    const markup = renderPlaygroundPanelMarkup({
      isChatLocked: true,
    });

    expect(markup).toMatch(/<textarea[^>]*id="chat-input"[^>]*readOnly=""/);
    expect(markup).not.toMatch(/<textarea[^>]*id="chat-input"[^>]*\sdisabled=""/);
  });

  it("renders the chat composer as editable when chat is unlocked", () => {
    const markup = renderPlaygroundPanelMarkup({
      isChatLocked: false,
    });

    expect(markup).not.toMatch(/<textarea[^>]*id="chat-input"[^>]*readOnly=""/);
  });
});
