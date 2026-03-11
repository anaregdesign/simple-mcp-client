import { useMemo } from "react";
import {
  DEFAULT_AGENT_INSTRUCTION,
} from "~/lib/domain/value-objects/thread-defaults";
import {
  useWorkspaceDesktopUpdater,
} from "~/lib/client/usecase/workspace/desktop-updater/use-desktop-updater";
import {
  selectThreadOperationPhaseFlags,
} from "~/lib/client/usecase/workspace/threads/thread-guards";
import { findThreadStateById } from "~/lib/client/usecase/workspace/threads/thread-runtime";
import {
  readThreadRequestStateById,
} from "~/lib/client/usecase/workspace/threads/thread-request-state-store";
import { chatApiClient } from "~/lib/client/infrastructure/api/chat-api-client";
import { instructionPatchesApiClient } from "~/lib/client/infrastructure/api/instruction-patches-api-client";
import { threadTitleApiClient } from "~/lib/client/infrastructure/api/thread-title-api-client";
import {
  useAzureSettings,
} from "~/lib/client/usecase/workspace/azure-settings/use-azure-settings";
import {
  buildUnauthenticatedPanelProps,
  shouldShowAzureAuthPendingPanel,
} from "~/lib/client/usecase/workspace/unauthenticated-panel/selectors";
import {
  readSkillCommandSuggestions,
} from "~/lib/client/usecase/workspace/skills-catalog/selectors";
import type {
  ChatCommandProvider,
} from "~/lib/client/usecase/workspace/chat-composer/menu-state";
import {
  useWorkspaceInstructionEditor,
} from "~/lib/client/usecase/workspace/instruction-editor/use-workspace-instruction-editor";
import {
  useWorkspaceMcpProfiles,
} from "~/lib/client/usecase/workspace/mcp-profiles/use-workspace-mcp-profiles";
import {
  useThreadShell,
} from "~/lib/client/usecase/workspace/threads/use-shell";
import {
  useSkillCatalog,
} from "~/lib/client/usecase/workspace/skills-catalog/use-skill-catalog";
import {
  selectThreadViewModel,
} from "~/lib/client/usecase/workspace/threads/selectors";
import {
  useWorkspacePlaygroundScreen,
} from "~/lib/client/usecase/workspace/playground-panel/use-workspace-playground-screen";
import {
  createThreadStorageRuntime,
} from "~/lib/client/usecase/workspace/threads/storage-runtime";
import {
  useWorkspaceThreads,
} from "~/lib/client/usecase/workspace/threads/use-workspace-threads";
import {
  useWorkspaceConfigScreen,
} from "~/lib/client/usecase/workspace/config-panel/use-workspace-config-screen";
import {
  useWorkspaceRuntimeLogging,
} from "~/lib/client/usecase/workspace/runtime-logging/use-runtime-logging";
import type { WorkspaceScreenRuntime } from "./use-workspace-screen-runtime";

export function useWorkspaceScreenFeatures(runtime: WorkspaceScreenRuntime) {
  const {
    endOfMessagesRef,
    chatInputRef,
    pendingChatCommandCursorIndexRef,
    chatAttachmentInputRef,
    draft,
    setDraft,
    chatComposerCursorIndex,
    setChatComposerCursorIndex,
    chatCommandHighlightedIndex,
    setChatCommandHighlightedIndex,
    draftAttachments,
    setDraftAttachments,
    chatAttachmentError,
    setChatAttachmentError,
    reasoningEffort,
    setReasoningEffort,
    webSearchEnabled,
    setWebSearchEnabled,
    isComposing,
    setIsComposing,
    uiError,
    setUiError,
    systemNotice,
    setSystemNotice,
    selectedMessageSkillActivations,
    setSelectedMessageSkillActivations,
    resetPlaygroundSession,
    applyThreadPlaygroundState: applyPlaygroundSessionState,
    activeMainTab,
    activeMainTabRef,
    setActiveMainTab,
    threadRequestStateCollection,
    dispatchThreadRequestState,
    activeAzureTenantIdRef,
    activeAzurePrincipalIdRef,
    activeWorkspaceUserKeyRef,
    selectedPlaygroundAzureConnectionIdRef,
    selectedPlaygroundAzureDeploymentNameRef,
    selectedUtilityAzureConnectionIdRef,
    selectedUtilityAzureDeploymentNameRef,
    layoutRef,
    rightPaneWidth,
    isMainSplitterResizing,
    onMainSplitterPointerDown,
  } = runtime;
  const threadRequestStateById =
    threadRequestStateCollection.threadRequestStateById;
  const {
    threads,
    setThreads,
    threadsRef,
    activeThreadId,
    setActiveThreadId,
    activeThreadIdRef,
    activeThreadNameInput,
    setActiveThreadNameInput,
    isSavingThread,
    setIsSavingThread,
    threadOperationPhase,
    setThreadOperationPhase,
    threadError,
    setThreadError,
    setThreadsState,
    updateThreadsState,
    updateThreadStateById,
    appendMessageToThreadState,
    appendThreadOperationLogToThreadState,
    applyThreadEnvironmentToThreadState,
    readThreadRequestState,
    updateThreadRequestState,
    assignThreadSendAbortController,
    clearThreadSendAbortController,
    cancelThreadInProgressProcessing,
    appendThreadProgressMessage,
    clearThreadNameSaveTimeout,
    clearThreadTitleRefreshTimeout,
    clearThreadSaveTimeout,
    scheduleThreadNameSaveTimeout,
    scheduleThreadTitleRefreshTimeout,
    scheduleThreadSaveTimeout,
    clearThreadsState,
    beginThreadOperation,
    resetThreadOperationPhase,
    endThreadOperation,
    isArchivedThread,
    createLocalThreadState,
    buildThreadStateFromCurrentState,
    nextThreadLoadRequestSeq,
    nextThreadSaveRequestSeq,
    readThreadLoadRequestSeq,
    readThreadSaveRequestSeq,
    readActiveThreadNameInput,
    readIsThreadsReady,
    readIsApplyingThreadState,
    readSavedThreadSignature,
    rememberThreadSaveSignature,
    writeThreadSaveSignature,
    setThreadsReady,
    setThreadSaveSignatures,
    applyThreadState,
    clearActiveThreadState,
    showThreadReloadPlaceholder,
  } = useThreadShell({
    threadRequestStateById,
    dispatchThreadRequestState,
    readDefaultThreadMcpServers: () =>
      mcpProfiles.readWorkspaceMcpServerProfiles().filter(
        (server) => server.connectOnThreadCreate === true,
      ),
    readCurrentThreadDraftState: () => ({
      reasoningEffort,
      webSearchEnabled,
      chatAzureConfig:
        activePlaygroundAzureConnection &&
        selectedPlaygroundAzureDeploymentName.trim()
          ? {
              tenantId: activeAzureTenantIdRef.current,
              projectId: activePlaygroundAzureConnection.id,
              projectName: activePlaygroundAzureConnection.projectName,
              baseUrl: activePlaygroundAzureConnection.baseUrl,
              apiVersion: activePlaygroundAzureConnection.apiVersion,
              deploymentName: selectedPlaygroundAzureDeploymentName.trim(),
            }
          : null,
      agentInstruction: instructionEditor.agentInstruction,
      instructionContextToggles: instructionEditor.instructionContextToggles,
      messages,
      mcpServers,
      mcpRpcLogs,
      selectedThreadSkills,
    }),
    resetPlaygroundSession,
    applyThreadPlaygroundState: (thread) => {
      applyPlaygroundSessionState(thread);
      if (thread.chatAzureConfig) {
        handleSelectPlaygroundProject(thread.chatAzureConfig.projectId);
        handleSelectPlaygroundDeployment(thread.chatAzureConfig.deploymentName);
      }
    },
    resetInstructionEditor: () => {
      instructionEditor.resetInstructionEditor();
    },
    applyThreadInstructionState: (thread) => {
      instructionEditor.applyThreadInstructionState(thread);
    },
  });
  const {
    logClientError,
    logClientWarning,
    logClientInfo,
  } = useWorkspaceRuntimeLogging({
    readActiveMainTab: () => activeMainTabRef.current,
    readActiveThreadId: () => activeThreadIdRef.current,
    readSelectedPlaygroundAzureConnectionId: () =>
      selectedPlaygroundAzureConnectionIdRef.current,
    readSelectedPlaygroundAzureDeploymentName: () =>
      selectedPlaygroundAzureDeploymentNameRef.current,
    readSelectedUtilityAzureConnectionId: () =>
      selectedUtilityAzureConnectionIdRef.current,
    readSelectedUtilityAzureDeploymentName: () =>
      selectedUtilityAzureDeploymentNameRef.current,
    readActiveAzureTenantId: () => activeAzureTenantIdRef.current,
    readActiveAzurePrincipalId: () => activeAzurePrincipalIdRef.current,
  });
  const threadOperationPhaseFlags =
    selectThreadOperationPhaseFlags(threadOperationPhase);
  const isLoadingThreads = threadOperationPhaseFlags.isLoadingThreads;
  const isSwitchingThread = threadOperationPhaseFlags.isSwitchingThread;
  const isCreatingThread = threadOperationPhaseFlags.isCreatingThread;
  const isDeletingThread = threadOperationPhaseFlags.isDeletingThread;
  const isClearingThread = threadOperationPhaseFlags.isClearingThread;
  const isRestoringThread = threadOperationPhaseFlags.isRestoringThread;
  const isThreadOperationBusy = threadOperationPhaseFlags.isThreadOperationBusy;
  const activeThreadRequestState = readThreadRequestStateById(
    threadRequestStateCollection,
    activeThreadId,
  );
  const isSending = activeThreadRequestState.isSending;

  async function loadThreads(): Promise<void> {
    await threadStorageRuntime.loadThreads();
  }

  function clearWorkspaceMcpServerProfilesState(
    nextError?: string | null,
  ): void {
    mcpProfiles.clearWorkspaceMcpServerProfilesState(nextError);
  }

  async function loadWorkspaceMcpServerProfiles(): Promise<void> {
    await mcpProfiles.loadWorkspaceMcpServerProfiles();
  }

  const azureSettings = useAzureSettings({
    isSending,
    reasoningEffort,
    webSearchEnabled,
    readIsThreadsReady,
    readIsLoadingThreads: () => isLoadingThreads,
    setSystemNotice,
    readActiveAzureTenantId: () => activeAzureTenantIdRef.current,
    writeActiveAzureTenantId: (value: string) => {
      activeAzureTenantIdRef.current = value;
    },
    readActiveAzurePrincipalId: () => activeAzurePrincipalIdRef.current,
    writeActiveAzurePrincipalId: (value: string) => {
      activeAzurePrincipalIdRef.current = value;
    },
    readActiveWorkspaceUserKey: () => activeWorkspaceUserKeyRef.current,
    writeActiveWorkspaceUserKey: (value: string) => {
      activeWorkspaceUserKeyRef.current = value;
    },
    readSelectedPlaygroundAzureConnectionId: () =>
      selectedPlaygroundAzureConnectionIdRef.current,
    writeSelectedPlaygroundAzureConnectionId: (value: string) => {
      selectedPlaygroundAzureConnectionIdRef.current = value;
    },
    writeSelectedPlaygroundAzureDeploymentName: (value: string) => {
      selectedPlaygroundAzureDeploymentNameRef.current = value;
    },
    readSelectedUtilityAzureConnectionId: () =>
      selectedUtilityAzureConnectionIdRef.current,
    writeSelectedUtilityAzureConnectionId: (value: string) => {
      selectedUtilityAzureConnectionIdRef.current = value;
    },
    writeSelectedUtilityAzureDeploymentName: (value: string) => {
      selectedUtilityAzureDeploymentNameRef.current = value;
    },
    clearWorkspaceMcpServerProfilesState,
    loadWorkspaceMcpServerProfiles,
    clearThreadsState,
    showThreadReloadPlaceholder,
    loadThreads,
    logClientError,
    logClientWarning,
  });
  const {
    theme,
    azureConnections,
    azureTenants,
    playgroundAzureDeployments,
    utilityAzureDeployments,
    playgroundAzureDeploymentNames,
    utilityAzureDeploymentNames,
    activeAzurePrincipal,
    activePlaygroundAzureConnection,
    activeUtilityAzureConnection,
    selectedPlaygroundAzureConnectionId,
    selectedPlaygroundAzureDeploymentName,
    selectedUtilityAzureConnectionId,
    selectedUtilityAzureDeploymentName,
    isLoadingAzureConnections,
    isLoadingPlaygroundAzureDeployments,
    isLoadingUtilityAzureDeployments,
    azureConnectionError,
    playgroundAzureDeploymentError,
    utilityAzureDeploymentError,
    isAzureAuthRequired,
    utilityReasoningEffort,
    isStartingAzureLogin,
    isSwitchingAzureTenant,
    isStartingAzureLogout,
    isReloadingAzureCatalog,
    azureLoginError,
    azureTenantSwitchError,
    azureLogoutError,
    effectivePlaygroundReasoningEffortOptions,
    effectiveUtilityReasoningEffortOptions,
    effectiveUtilityReasoningEffort,
    isPlaygroundReasoningEffortSupported,
    selectedPlaygroundDeploymentCompatibleReasoningEffortOptions,
    isSelectedPlaygroundReasoningEffortOptionAvailable,
    isPlaygroundReasoningEffortWebSearchCompatible,
    isUtilityReasoningEffortSupported,
    clearAzureSessionStatus,
    markAzureAuthRequired,
    resolveAzureBackgroundSuccess,
    reportAzureTenantSwitchPending,
    handleThemeChange,
    handleAzureLogin,
    handleAzureTenantChange,
    handleAzureLogout,
    handleReloadAzureCatalog,
    handleSelectPlaygroundProject,
    handleSelectPlaygroundDeployment,
    handleSelectUtilityProject,
    handleSelectUtilityDeployment,
    handleUtilityReasoningEffortChange: handleAzureUtilityReasoningEffortChange,
    loadAzureProjects,
    isPlaygroundDeploymentAvailable,
    isUtilityDeploymentAvailable,
    isPlaygroundReasoningEffortOptionAvailable,
  } = azureSettings;
  const isChatLocked = isAzureAuthRequired;
  const instructionEditor = useWorkspaceInstructionEditor({
    activeThreadId,
    editing: {
      isArchivedThread,
      readActiveThreadId: () => activeThreadIdRef.current,
      logClientError,
    },
    prompt: {
      isArchivedThread,
      readActiveThreadId: () => activeThreadIdRef.current,
      setActiveMainTab,
      isChatLocked,
      readActiveAzureTenantId: () => activeAzureTenantIdRef.current,
      readActiveUtilityAzureConnection: () => activeUtilityAzureConnection,
      readSelectedUtilityAzureDeploymentName: () =>
        selectedUtilityAzureDeploymentName,
      readUtilityAzureDeployments: () => utilityAzureDeployments,
      isLoadingUtilityAzureDeployments,
      isUtilityReasoningEffortSupported,
      readEffectiveUtilityReasoningEffort: () =>
        effectiveUtilityReasoningEffort,
      readEffectiveUtilityReasoningEffortOptions: () =>
        effectiveUtilityReasoningEffortOptions,
      handleSelectUtilityProject,
      handleSelectUtilityDeployment,
      handleAzureUtilityReasoningEffortChange,
      requestInstructionEnhancement: (request) =>
        instructionPatchesApiClient.enhanceInstruction(request, {
          onAuthRequired: () => {
            markAzureAuthRequired();
          },
        }),
      refreshThreadTitleInBackground: async (request) => {
        await workspaceThreads.refreshThreadTitleInBackground(request);
      },
      logClientError,
    },
  });
  const sendProgressMessages = activeThreadRequestState.sendProgressMessages;
  const activeTurnId = activeThreadRequestState.activeTurnId;
  const lastErrorTurnId = activeThreadRequestState.lastErrorTurnId;
  const error = uiError ?? activeThreadRequestState.error;
  const {
    activeThreadState,
    messages,
    mcpServers,
    mcpRpcLogs,
    selectedThreadSkills,
    isActiveThreadArchived,
    activeThreadOptions,
    archivedThreadOptions,
  } = useMemo(
    () =>
      selectThreadViewModel({
        threads,
        activeThreadId,
        activeThreadNameInput,
        threadRequestStateById,
      }),
    [activeThreadId, activeThreadNameInput, threadRequestStateById, threads],
  );
  const skillCatalog = useSkillCatalog({
    readActiveWorkspaceUserKey: () => activeWorkspaceUserKeyRef.current,
    activeAzurePrincipal,
    isAzureAuthRequired,
    markAzureAuthRequired,
    resolveAzureBackgroundSuccess,
    readActiveThreadId: () => activeThreadIdRef.current,
    updateThreadStateById,
    selectedThreadSkills,
    selectedMessageSkillActivations,
    setSelectedMessageSkillActivations,
    logClientError,
  });
  const {
    isMutatingSkillRegistries,
    skillRegistryError,
    setSkillRegistryWarning,
    skillRegistryWarning,
    setSkillRegistrySuccess,
    skillRegistrySuccess,
    isLoadingSkills,
    skillsError,
    setSkillsWarning,
    skillsWarning,
    threadSkillOptions,
    messageSkillActivationOptions,
    skillRegistryGroups,
    handleReloadSkills,
    handleToggleRegistrySkill,
    handleAddMessageSkillActivation,
    handleRemoveMessageSkillActivation,
    handleRemoveThreadSkill,
    handleToggleThreadSkill,
  } = skillCatalog;
  const threadStorageRuntime = createThreadStorageRuntime({
    persistence: {
      readActiveWorkspaceUserKey: () => activeWorkspaceUserKeyRef.current,
      readActiveThreadId: () => activeThreadIdRef.current,
      readThreads: () => threadsRef.current,
      readSavedThreadSignature,
      writeThreadSaveSignature,
      nextThreadSaveRequestSeq,
      readThreadSaveRequestSeq,
      setIsSavingThread,
      markAzureAuthRequired,
      setThreadError,
      updateThreadsState,
      setActiveThreadNameInput,
      buildThreadStateFromCurrentState,
      clearThreadNameSaveTimeout,
      clearThreadSaveTimeout,
      logClientInfo,
      logClientError,
    },
    loading: {
      readActiveWorkspaceUserKey: () => activeWorkspaceUserKeyRef.current,
      readPreferredThreadId: () => activeThreadIdRef.current,
      nextThreadLoadRequestSeq,
      readThreadLoadRequestSeq,
      setThreadsReady,
      clearThreadsState,
      beginLoadingThreadOperation: () => beginThreadOperation("loading"),
      endLoadingThreadOperation: () => endThreadOperation("loading"),
      setThreadError,
      markAzureAuthRequired,
      setThreadSaveSignatures,
      setThreadsState,
      pruneThreadRequestState: (validThreadIds) => {
        dispatchThreadRequestState({
          type: "thread_request_state/prune",
          validThreadIds,
        });
      },
      applyThreadState,
      createLocalThreadState,
      logClientInfo,
      logClientError,
    },
  });
  const mcpProfiles = useWorkspaceMcpProfiles({
    readActiveWorkspaceUserKey: () => activeWorkspaceUserKeyRef.current,
    isArchivedThread,
    readActiveThreadId: () => activeThreadIdRef.current,
    readActiveThreadMcpServers: () => mcpServers,
    updateThreadStateById,
    markAzureAuthRequired,
    logClientError,
    logClientWarning,
  });
  const chatCommandProviders: ChatCommandProvider[] = [
    {
      keyword: "$",
      emptyHint: "No matching Skills.",
      readSuggestions: (query) =>
        readSkillCommandSuggestions(messageSkillActivationOptions, query),
      applySuggestion: (suggestion) => {
        if (!suggestion.isAvailable) {
          return;
        }

        handleAddMessageSkillActivation(suggestion.id);
      },
    },
  ];
  const desktopUpdater = useWorkspaceDesktopUpdater({
    setUiError,
    setSystemNotice,
    logClientError,
    logClientWarning,
  });

  const workspaceThreads = useWorkspaceThreads({
    title: {
      readThreadById: (threadId) =>
        findThreadStateById(threadsRef.current, threadId) ?? undefined,
      readActiveThreadId: () => activeThreadIdRef.current,
      readActiveThreadNameInput,
      readActiveAzureTenantId: () => activeAzureTenantIdRef.current,
      isArchivedThread,
      isChatLocked,
      isLoadingUtilityAzureDeployments,
      readActiveUtilityAzureConnection: () => activeUtilityAzureConnection,
      readSelectedUtilityAzureDeploymentName: () =>
        selectedUtilityAzureDeploymentName,
      isSelectedUtilityDeploymentAvailable: isUtilityDeploymentAvailable,
      readAgentInstruction: () => instructionEditor.agentInstruction,
      isUtilityReasoningEffortSupported,
      readEffectiveUtilityReasoningEffort: () =>
        effectiveUtilityReasoningEffort,
      generateTitle: (request) => threadTitleApiClient.generateTitle(request),
      updateThreadStateById,
      setActiveThreadNameInput,
      saveActiveThreadNameInBackground:
        threadStorageRuntime.saveActiveThreadNameInBackground,
      isSwitchingAzureTenant,
      reportAzureTenantSwitchPending,
      logClientError,
    },
    sending: {
      readActiveThreadId: () => activeThreadIdRef.current,
      readActiveAzureTenantId: () => activeAzureTenantIdRef.current,
      readBaseThread: (threadId) =>
        findThreadStateById(threadsRef.current, threadId) ?? null,
      readDraft: () => draft,
      readSelectedPlaygroundAzureDeploymentName: () =>
        selectedPlaygroundAzureDeploymentName,
      isArchivedThread,
      readThreadRequestState,
      readThreadOperationPhase: () => threadOperationPhase,
      isChatLocked,
      readActivePlaygroundAzureConnection: () =>
        activePlaygroundAzureConnection,
      isAzureAuthRequired,
      isLoadingPlaygroundAzureDeployments,
      isSelectedPlaygroundDeploymentAvailable: isPlaygroundDeploymentAvailable,
      isPlaygroundReasoningEffortSupported,
      isSelectedPlaygroundReasoningEffortOptionAvailable:
        isPlaygroundReasoningEffortOptionAvailable,
      readReasoningEffort: () => reasoningEffort,
      readWebSearchEnabled: () => webSearchEnabled,
      readDraftAttachments: () => draftAttachments,
      readMessages: () => messages,
      readMcpServers: () => mcpServers,
      readSelectedMessageSkillActivations: () =>
        selectedMessageSkillActivations,
      readSelectedThreadSkills: () => selectedThreadSkills,
      readAgentInstruction: () => instructionEditor.agentInstruction,
      readInstructionContextToggles: () =>
        instructionEditor.instructionContextToggles,
      setThreadError,
      setUiError,
      setActiveMainTab,
      appendMessageToThreadState,
      setDraft,
      setSelectedMessageSkillActivations,
      setDraftAttachments,
      setChatAttachmentError,
      setSystemNotice,
      clearAzureSessionStatus,
      updateThreadRequestState,
      logClientInfo,
      logClientError,
      assignThreadSendAbortController,
      saveThreadStateToDatabase: threadStorageRuntime.saveThreadStateToDatabase,
      markAzureAuthRequired,
      sendMessage: (payload, sendOptions) =>
        chatApiClient.sendMessage(payload, sendOptions),
      appendThreadProgressMessage,
      appendThreadOperationLogToThreadState,
      applyThreadEnvironmentToThreadState,
      clearThreadSendAbortController,
      scheduleThreadStateSave: threadStorageRuntime.scheduleThreadStateSave,
    },
    lifecycle: {
      isSending,
      threadOperationPhase,
      readThreads: () => threadsRef.current,
      readActiveThreadId: () => activeThreadIdRef.current,
      beginThreadOperation,
      endThreadOperation,
      readThreadRequestState,
      updateThreadStateById,
      updateThreadsState,
      readSavedThreadSignature,
      setThreadsReady,
      rememberThreadSaveSignature,
      applyThreadState,
      clearActiveThreadState,
      buildThreadStateFromCurrentState,
      saveThreadStateToDatabase: threadStorageRuntime.saveThreadStateToDatabase,
      flushActiveThreadState: threadStorageRuntime.flushActiveThreadState,
      cancelThreadInProgressProcessing,
      createLocalThreadState,
      loadThreads: threadStorageRuntime.loadThreads,
      removeThreadRequestState: (threadId) => {
        dispatchThreadRequestState({
          type: "thread_request_state/remove",
          threadId,
        });
      },
      setThreadError,
      setSystemNotice,
      setActiveMainTab,
      setActiveThreadNameInput,
      markAzureAuthRequired,
      logClientInfo,
      logClientError,
    },
    backgroundEffects: {
      activeThreadId,
      activeThreadNameInput,
      agentInstruction: instructionEditor.agentInstruction,
      instructionContextToggles: instructionEditor.instructionContextToggles,
      isChatLocked,
      isLoadingUtilityAzureDeployments,
      isSending,
      mcpRpcLogs,
      mcpServers,
      messages,
      reasoningEffort,
      selectedThreadSkills,
      selectedUtilityAzureConnectionId,
      selectedUtilityAzureDeploymentName,
      threadOperationPhase,
      threads,
      utilityAzureDeployments,
      webSearchEnabled,
      readIsThreadsReady,
      readIsApplyingThreadState,
      clearThreadNameSaveTimeout,
      clearThreadSaveTimeout,
      clearThreadTitleRefreshTimeout,
      scheduleThreadNameSaveTimeout,
      scheduleThreadSaveTimeout,
      scheduleThreadTitleRefreshTimeout,
      readThreadById: (threadId) =>
        findThreadStateById(threadsRef.current, threadId) ?? undefined,
      isArchivedThread,
      isSelectedUtilityDeploymentAvailable: isUtilityDeploymentAvailable,
      buildThreadStateFromCurrentState,
      readSavedThreadSignature,
      saveThreadStateToDatabase: threadStorageRuntime.saveThreadStateToDatabase,
      saveActiveThreadNameInBackground:
        threadStorageRuntime.saveActiveThreadNameInBackground,
    },
  });
  const {
    handleCreateThread,
    handleThreadRename,
    handleThreadCancel,
    handleThreadClear,
    handleThreadLogicalDelete,
    handleThreadRestore,
    handleThreadChange,
    sendMessage,
  } = workspaceThreads;

  const { configPanelProps } = useWorkspaceConfigScreen({
    chrome: {
      activeMainTab,
      setActiveMainTab,
      isChatLocked,
    },
    azureSettings,
    instructionEditor,
    mcpProfiles,
    skillCatalog,
    threadView: {
      activeThreadOptions,
      archivedThreadOptions,
      activeThreadId,
      isSending,
      isActiveThreadArchived,
      isLoadingThreads,
      isSwitchingThread,
      isCreatingThread,
      isDeletingThread,
      isClearingThread,
      isRestoringThread,
      threadError,
    },
    threadHandlers: {
      handleThreadChange,
      handleCreateThread,
      handleThreadRename,
      handleThreadCancel,
      handleThreadLogicalDelete,
      handleThreadClear,
      handleThreadRestore,
    },
  });
  const { playgroundPanelProps } = useWorkspacePlaygroundScreen({
    chatCommandProviders,
    session: {
      messages,
      mcpRpcLogs,
      sendProgressMessages,
      activeTurnId,
      lastErrorTurnId,
      endOfMessagesRef,
      chatInputRef,
      pendingChatCommandCursorIndexRef,
      messageAttachmentInputRef: chatAttachmentInputRef,
      draft,
      draftAttachments,
      chatAttachmentError,
      chatComposerCursorIndex,
      setChatComposerCursorIndex,
      chatCommandHighlightedIndex,
      setChatCommandHighlightedIndex,
      isComposing,
      setDraft,
      setChatAttachmentError,
      setDraftAttachments,
      setIsComposing,
      reasoningEffort,
      webSearchEnabled,
      systemNotice,
      error,
      azureLoginError,
      setReasoningEffort,
      setWebSearchEnabled,
      setSystemNotice,
      setUiError,
      setActiveMainTab,
      selectedMessageSkillActivations,
      setSelectedMessageSkillActivations,
      logClientError,
    },
    thread: {
      activeThreadId,
      activeThreadName: activeThreadNameInput,
      isSending,
      isCreatingThread,
      isThreadOperationBusy,
      isActiveThreadArchived,
      threadOperationPhase,
      mcpServers,
      selectedThreadSkills,
    },
    threadHandlers: {
      handleCreateThread,
      handleThreadCancel,
      sendMessage,
    },
    azureSettings,
    desktopUpdater,
    mcpProfiles,
    skillCatalog: {
      handleRemoveThreadSkill,
      handleRemoveMessageSkillActivation,
    },
  });
  const unauthenticatedPanelProps = buildUnauthenticatedPanelProps({
    isStartingAzureLogin,
    onAzureLogin: handleAzureLogin,
  });
  const isResolvingAzureAuth = shouldShowAzureAuthPendingPanel({
    isLoadingAzureConnections,
    isAzureAuthRequired,
    activeAzurePrincipal,
    azureConnectionCount: azureConnections.length,
    azureConnectionError,
  });

  return {
    theme,
    layout: {
      layoutRef,
      rightPaneWidth,
      isMainSplitterResizing,
      onMainSplitterPointerDown,
    },
    auth: {
      isAzureAuthRequired,
      isResolvingAzureAuth,
      unauthenticatedPanelProps,
    },
    config: {
      ...configPanelProps,
    },
    playground: playgroundPanelProps,
  };
}
