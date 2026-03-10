import { describe, expect, it, vi } from "vitest";
import {
  buildWorkspacePlaygroundPanelProps,
} from "~/lib/client/usecase/workspace/playground-panel/panel-props";

function createOptions() {
  return {
    messages: [],
    threadOperationLogsByTurnId: new Map(),
    isSending: false,
    isThreadReadOnly: false,
    desktopUpdaterStatus: {
      supported: true,
      checking: false,
      updateAvailable: false,
      updateDownloaded: false,
      currentVersion: "1.0.0",
      availableVersion: "",
      errorMessage: "",
      lastCheckedAt: "",
    },
    desktopUpdaterActionState: "check" as const,
    isApplyingDesktopUpdate: false,
    handleCheckDesktopUpdates: vi.fn().mockResolvedValue(undefined),
    handleApplyDesktopUpdate: vi.fn().mockResolvedValue(undefined),
    activeThreadName: "Thread 1",
    isThreadOperationBusy: false,
    isCreatingThread: false,
    handleCreateThread: vi.fn().mockResolvedValue(undefined),
    handleThreadCancel: vi.fn(),
    readActiveThreadId: vi.fn(() => "thread-1"),
    onCopyMessage: vi.fn(),
    onCopyOperationLog: vi.fn(),
    sendProgressMessages: [],
    activeTurnOperationLogs: [],
    errorTurnOperationLogs: [],
    endOfMessagesRef: { current: null },
    systemNotice: null,
    setSystemNotice: vi.fn(),
    error: null,
    azureLoginError: null,
    onSubmit: vi.fn(),
    chatInputRef: { current: null },
    messageAttachmentInputRef: { current: null },
    messageAttachmentAccept: ".md,.txt",
    messageAttachmentFormatHint: "Markdown, text",
    draft: "",
    messageAttachments: [],
    messageAttachmentError: null,
    onDraftChange: vi.fn(),
    onInputSelect: vi.fn(),
    onOpenMessageAttachmentPicker: vi.fn(),
    onMessageAttachmentFileChange: vi.fn(),
    onRemoveMessageAttachment: vi.fn(),
    onInputKeyDown: vi.fn(),
    chatCommandMenu: null,
    onSelectChatCommandSuggestion: vi.fn(),
    onHighlightChatCommandSuggestion: vi.fn(),
    setIsComposing: vi.fn(),
    isChatLocked: false,
    isLoadingAzureConnections: false,
    isLoadingAzureDeployments: false,
    isAzureAuthRequired: false,
    isStartingAzureLogin: false,
    isStartingAzureLogout: false,
    onChatAzureSelectorAction: vi.fn(),
    azureConnections: [],
    activeAzureConnectionId: "",
    onProjectChange: vi.fn(),
    selectedAzureDeploymentName: "",
    azureDeployments: [],
    onDeploymentChange: vi.fn(),
    reasoningEffort: "medium" as const,
    reasoningEffortOptions: ["medium"] as Array<"medium">,
    isReasoningEffortSupported: true,
    onReasoningEffortChange: vi.fn(),
    webSearchEnabled: false,
    onWebSearchEnabledChange: vi.fn(),
    canSendMessage: true,
    selectedThreadSkills: [],
    selectedMessageSkillActivations: [],
    onRemoveThreadSkill: vi.fn(),
    onRemoveMessageSkillActivation: vi.fn(),
    mcpServers: [],
    onRemoveMcpServer: vi.fn(),
  };
}

describe("buildWorkspacePlaygroundPanelProps", () => {
  it("reads the active thread id when cancelling processing", () => {
    const options = createOptions();
    const props = buildWorkspacePlaygroundPanelProps(options);

    props.onCancelThreadProcessing();

    expect(options.readActiveThreadId).toHaveBeenCalledTimes(1);
    expect(options.handleThreadCancel).toHaveBeenCalledWith("thread-1");
  });

  it("maps composition lifecycle callbacks to the composing setter", () => {
    const options = createOptions();
    const props = buildWorkspacePlaygroundPanelProps(options);

    props.onCompositionStart();
    props.onCompositionEnd();

    expect(options.setIsComposing).toHaveBeenNthCalledWith(1, true);
    expect(options.setIsComposing).toHaveBeenNthCalledWith(2, false);
  });
});
