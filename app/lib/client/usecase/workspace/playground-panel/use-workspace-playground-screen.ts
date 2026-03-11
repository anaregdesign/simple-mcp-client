import type { Dispatch, SetStateAction } from "react";
import type { DraftChatAttachment } from "~/lib/contracts/chat/attachments";
import type { ThreadMessage } from "~/lib/contracts/chat/messages";
import type { ThreadOperationLogEntry } from "~/lib/contracts/chat/operation-log";
import type { McpServerConfig } from "~/lib/contracts/mcp/profile";
import type { ThreadSkillActivation } from "~/lib/contracts/skills/types";
import type { AzureSettingsController } from "~/lib/client/usecase/workspace/azure-settings/types";
import type {
  ChatCommandProvider,
} from "~/lib/client/usecase/workspace/chat-composer/menu-state";
import type {
  WorkspaceDesktopUpdaterController,
} from "~/lib/client/usecase/workspace/desktop-updater/use-desktop-updater";
import type {
  WorkspaceMcpProfilesController,
} from "~/lib/client/usecase/workspace/mcp-profiles/use-workspace-mcp-profiles";
import type { SkillCatalogController } from "~/lib/client/usecase/workspace/skills-catalog/use-skill-catalog";
import type { ThreadOperationPhase } from "~/lib/client/usecase/workspace/threads/thread-operation-phase";
import {
  useWorkspacePlayground,
} from "~/lib/client/usecase/workspace/playground-panel/use-workspace-playground";

type WorkspacePlaygroundSessionState = {
  messages: ThreadMessage[];
  mcpRpcLogs: ThreadOperationLogEntry[];
  sendProgressMessages: string[];
  activeTurnId: string | null;
  lastErrorTurnId: string | null;
  endOfMessagesRef: { current: HTMLDivElement | null };
  chatInputRef: { current: HTMLTextAreaElement | null };
  pendingChatCommandCursorIndexRef: { current: number | null };
  messageAttachmentInputRef: { current: HTMLInputElement | null };
  draft: string;
  draftAttachments: DraftChatAttachment[];
  chatAttachmentError: string | null;
  chatComposerCursorIndex: number;
  chatCommandHighlightedIndex: number;
  isComposing: boolean;
  reasoningEffort: AzureSettingsController["effectivePlaygroundReasoningEffortOptions"][number];
  webSearchEnabled: boolean;
  systemNotice: string | null;
  error: string | null;
  azureLoginError: string | null;
  setDraft: (value: string) => void;
  setChatComposerCursorIndex: Dispatch<SetStateAction<number>>;
  setChatCommandHighlightedIndex: Dispatch<SetStateAction<number>>;
  setChatAttachmentError: (value: string | null) => void;
  setDraftAttachments: Dispatch<SetStateAction<DraftChatAttachment[]>>;
  setIsComposing: (value: boolean) => void;
  setReasoningEffort: (
    value: AzureSettingsController["effectivePlaygroundReasoningEffortOptions"][number],
  ) => void;
  setWebSearchEnabled: (value: boolean) => void;
  setSystemNotice: (value: string | null) => void;
  setUiError: (value: string | null) => void;
  setActiveMainTab: (tab: "settings" | "mcp" | "skills" | "threads") => void;
  selectedMessageSkillActivations: ThreadSkillActivation[];
  setSelectedMessageSkillActivations: (
    value:
      | ThreadSkillActivation[]
      | ((current: ThreadSkillActivation[]) => ThreadSkillActivation[]),
  ) => void;
  logClientError: (
    eventName: string,
    error: unknown,
    options?: {
      category?: string;
      location?: string;
      action?: string;
      statusCode?: number;
      context?: Record<string, unknown>;
    },
  ) => void;
};

type WorkspacePlaygroundThreadState = {
  activeThreadId: string;
  activeThreadName: string;
  isSending: boolean;
  isCreatingThread: boolean;
  isThreadOperationBusy: boolean;
  isActiveThreadArchived: boolean;
  threadOperationPhase: ThreadOperationPhase;
  mcpServers: McpServerConfig[];
  selectedThreadSkills: ThreadSkillActivation[];
};

type WorkspacePlaygroundThreadHandlers = {
  handleCreateThread: () => Promise<void> | void;
  handleThreadCancel: (threadId: string) => void;
  sendMessage: () => Promise<void>;
};

type UseWorkspacePlaygroundScreenOptions = {
  chatCommandProviders: readonly ChatCommandProvider[];
  session: WorkspacePlaygroundSessionState;
  thread: WorkspacePlaygroundThreadState;
  threadHandlers: WorkspacePlaygroundThreadHandlers;
  azureSettings: AzureSettingsController;
  desktopUpdater: WorkspaceDesktopUpdaterController;
  mcpProfiles: Pick<WorkspaceMcpProfilesController, "handleRemoveMcpServer">;
  skillCatalog: Pick<
    SkillCatalogController,
    | "handleRemoveThreadSkill"
    | "handleRemoveMessageSkillActivation"
  >;
};

export function useWorkspacePlaygroundScreen(
  options: UseWorkspacePlaygroundScreenOptions,
) {
  return useWorkspacePlayground({
    chatCommandProviders: options.chatCommandProviders,
    runtime: {
      messages: options.session.messages,
      isSending: options.thread.isSending,
      sendProgressMessages: options.session.sendProgressMessages,
      endOfMessagesRef: options.session.endOfMessagesRef,
      chatInputRef: options.session.chatInputRef,
      pendingChatCommandCursorIndexRef:
        options.session.pendingChatCommandCursorIndexRef,
      draft: options.session.draft,
      chatComposerCursorIndex: options.session.chatComposerCursorIndex,
      setChatComposerCursorIndex: (value) => {
        options.session.setChatComposerCursorIndex(value);
      },
      chatCommandHighlightedIndex:
        options.session.chatCommandHighlightedIndex,
      setChatCommandHighlightedIndex:
        options.session.setChatCommandHighlightedIndex,
    },
    operationLogs: {
      mcpRpcLogs: options.session.mcpRpcLogs,
      activeTurnId: options.session.activeTurnId,
      lastErrorTurnId: options.session.lastErrorTurnId,
    },
    composerView: {
      draft: options.session.draft,
      draftAttachments: options.session.draftAttachments,
      threadOperationPhase: options.thread.threadOperationPhase,
      isSending: options.thread.isSending,
      isActiveThreadArchived: options.thread.isActiveThreadArchived,
      isChatLocked: options.azureSettings.isAzureAuthRequired,
      isLoadingAzureConnections:
        options.azureSettings.isLoadingAzureConnections,
      isLoadingAzureDeployments:
        options.azureSettings.isLoadingPlaygroundAzureDeployments,
      hasActiveThreadId: options.thread.activeThreadId.trim().length > 0,
      hasActivePlaygroundAzureConnection:
        !!options.azureSettings.activePlaygroundAzureConnection,
      hasSelectedPlaygroundAzureDeploymentName:
        options.azureSettings.selectedPlaygroundAzureDeploymentName.trim().length >
        0,
      isSelectedPlaygroundReasoningEffortOptionAvailable:
        options.azureSettings.isSelectedPlaygroundReasoningEffortOptionAvailable,
      isPlaygroundReasoningEffortWebSearchCompatible:
        options.azureSettings.isPlaygroundReasoningEffortWebSearchCompatible,
    },
    composerHandlers: {
      isArchivedThread: (_threadIdRaw: string) =>
        options.thread.isActiveThreadArchived,
      readActiveThreadId: () => options.thread.activeThreadId,
      isChatLocked: options.azureSettings.isAzureAuthRequired,
      isSending: options.thread.isSending,
      isComposing: options.session.isComposing,
      readDraft: () => options.session.draft,
      readDraftAttachments: () => options.session.draftAttachments,
      readChatAttachmentInput: () =>
        options.session.messageAttachmentInputRef.current,
      setPendingChatCommandCursorIndex: (value) => {
        options.session.pendingChatCommandCursorIndexRef.current = value;
      },
      setDraft: options.session.setDraft,
      setChatComposerCursorIndex:
        options.session.setChatComposerCursorIndex,
      setChatCommandHighlightedIndex:
        options.session.setChatCommandHighlightedIndex,
      setChatAttachmentError: options.session.setChatAttachmentError,
      setDraftAttachments: options.session.setDraftAttachments,
      setThreadError: options.session.setUiError,
      setActiveMainTab: options.session.setActiveMainTab,
      sendMessage: options.threadHandlers.sendMessage,
      logClientError: options.session.logClientError,
    },
    controlHandlers: {
      isSending: options.thread.isSending,
      isStartingAzureLogin: options.azureSettings.isStartingAzureLogin,
      isSwitchingAzureTenant: options.azureSettings.isSwitchingAzureTenant,
      isStartingAzureLogout: options.azureSettings.isStartingAzureLogout,
      isLoadingAzureConnections:
        options.azureSettings.isLoadingAzureConnections,
      isLoadingPlaygroundAzureDeployments:
        options.azureSettings.isLoadingPlaygroundAzureDeployments,
      isAzureAuthRequired: options.azureSettings.isAzureAuthRequired,
      azureConnectionError: options.azureSettings.azureConnectionError,
      hasAzureConnections:
        options.azureSettings.azureConnections.length > 0,
      hasActivePlaygroundAzureConnection:
        !!options.azureSettings.activePlaygroundAzureConnection,
      hasPlaygroundAzureDeployments:
        options.azureSettings.playgroundAzureDeployments.length > 0,
      hasSelectedPlaygroundAzureDeploymentName:
        options.azureSettings.selectedPlaygroundAzureDeploymentName.trim().length >
        0,
      isPlaygroundReasoningEffortSupported:
        options.azureSettings.isPlaygroundReasoningEffortSupported,
      selectedPlaygroundDeploymentCompatibleReasoningEffortOptions:
        options.azureSettings.selectedPlaygroundDeploymentCompatibleReasoningEffortOptions,
      effectivePlaygroundReasoningEffortOptions:
        options.azureSettings.effectivePlaygroundReasoningEffortOptions,
      reasoningEffort: options.session.reasoningEffort,
      setUiError: options.session.setUiError,
      setSystemNotice: options.session.setSystemNotice,
      setActiveMainTab: options.session.setActiveMainTab,
      setReasoningEffort: options.session.setReasoningEffort,
      setWebSearchEnabled: options.session.setWebSearchEnabled,
      clearAzureSessionStatus: options.azureSettings.clearAzureSessionStatus,
      markAzureAuthRequired: options.azureSettings.markAzureAuthRequired,
      handleAzureLogin: options.azureSettings.handleAzureLogin,
      handleSelectPlaygroundProject:
        options.azureSettings.handleSelectPlaygroundProject,
      handleSelectPlaygroundDeployment:
        options.azureSettings.handleSelectPlaygroundDeployment,
      loadAzureProjects: options.azureSettings.loadAzureProjects,
    },
    panel: {
      messages: options.session.messages,
      isSending: options.thread.isSending,
      isThreadReadOnly: options.thread.isActiveThreadArchived,
      desktopUpdaterStatus: options.desktopUpdater.desktopUpdaterStatus,
      desktopUpdaterActionState:
        options.desktopUpdater.desktopUpdaterActionState,
      isApplyingDesktopUpdate: options.desktopUpdater.isApplyingDesktopUpdate,
      handleCheckDesktopUpdates:
        options.desktopUpdater.handleCheckDesktopUpdates,
      handleApplyDesktopUpdate:
        options.desktopUpdater.handleApplyDesktopUpdate,
      activeThreadName: options.thread.activeThreadName,
      isThreadOperationBusy: options.thread.isThreadOperationBusy,
      isCreatingThread: options.thread.isCreatingThread,
      handleCreateThread: options.threadHandlers.handleCreateThread,
      handleThreadCancel: options.threadHandlers.handleThreadCancel,
      readActiveThreadId: () => options.thread.activeThreadId,
      sendProgressMessages: options.session.sendProgressMessages,
      endOfMessagesRef: options.session.endOfMessagesRef,
      systemNotice: options.session.systemNotice,
      setSystemNotice: options.session.setSystemNotice,
      error: options.session.error,
      azureLoginError: options.session.azureLoginError,
      chatInputRef: options.session.chatInputRef,
      messageAttachmentInputRef: options.session.messageAttachmentInputRef,
      draft: options.session.draft,
      messageAttachments: options.session.draftAttachments,
      messageAttachmentError: options.session.chatAttachmentError,
      setIsComposing: options.session.setIsComposing,
      isChatLocked: options.azureSettings.isAzureAuthRequired,
      isLoadingAzureConnections:
        options.azureSettings.isLoadingAzureConnections,
      isLoadingAzureDeployments:
        options.azureSettings.isLoadingPlaygroundAzureDeployments,
      isAzureAuthRequired: options.azureSettings.isAzureAuthRequired,
      isStartingAzureLogin: options.azureSettings.isStartingAzureLogin,
      isStartingAzureLogout: options.azureSettings.isStartingAzureLogout,
      azureConnections: options.azureSettings.azureConnections,
      activeAzureConnectionId:
        options.azureSettings.activePlaygroundAzureConnection?.id ?? "",
      selectedAzureDeploymentName:
        options.azureSettings.selectedPlaygroundAzureDeploymentName,
      azureDeployments: options.azureSettings.playgroundAzureDeploymentNames,
      reasoningEffort: options.session.reasoningEffort,
      reasoningEffortOptions:
        options.azureSettings.effectivePlaygroundReasoningEffortOptions,
      isReasoningEffortSupported:
        options.azureSettings.isPlaygroundReasoningEffortSupported,
      webSearchEnabled: options.session.webSearchEnabled,
      selectedThreadSkills: options.thread.selectedThreadSkills,
      selectedMessageSkillActivations:
        options.session.selectedMessageSkillActivations,
      onRemoveThreadSkill: options.skillCatalog.handleRemoveThreadSkill,
      onRemoveMessageSkillActivation:
        options.skillCatalog.handleRemoveMessageSkillActivation,
      mcpServers: options.thread.mcpServers,
      onRemoveMcpServer: options.mcpProfiles.handleRemoveMcpServer,
    },
  });
}
