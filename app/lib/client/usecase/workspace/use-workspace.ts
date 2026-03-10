/**
 * Workspace client usecase module.
 */
import {
  useMemo,
  useReducer,
  useRef,
} from "react";
import type { McpTransport } from "~/lib/domain/value-objects/mcp-transport";
import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";
import type { ThemeMode } from "~/lib/domain/value-objects/theme-mode";
import {
  DEFAULT_AGENT_INSTRUCTION,
  DEFAULT_WEB_SEARCH_ENABLED,
  THREAD_DEFAULT_NAME,
} from "~/lib/domain/value-objects/thread-defaults";
import {
  DEFAULT_THEME_MODE,
} from "~/lib/constants/client";
import {
  DEFAULT_MCP_TRANSPORT,
  MCP_DEFAULT_AZURE_AUTH_SCOPE,
  MCP_DEFAULT_TIMEOUT_SECONDS,
  MCP_TIMEOUT_SECONDS_MAX,
  MCP_TIMEOUT_SECONDS_MIN,
} from "~/lib/constants/mcp";
import type { DraftChatAttachment } from "~/lib/contracts/chat/attachments";
import type { ThreadMessage } from "~/lib/contracts/chat/messages";
import type {
  ThreadOperationLogEntry,
} from "~/lib/contracts/chat/operation-log";
import {
  isThreadArchivedById,
  type ThreadState,
} from "~/lib/client/usecase/workspace/threads/thread-state";
import {
  cloneThreadEnvironment,
  cloneThreadInstructionContexts,
  cloneThreadOperationLogs,
  cloneMcpServers,
  cloneMessages,
  cloneThreadSkillActivations,
  hasThreadInteraction,
  hasThreadPersistableState,
} from "~/lib/client/usecase/workspace/threads/thread-save-state";
import { readThreadEnvironmentFromUnknown } from "~/lib/domain/value-objects/thread-environment";
import {
  DEFAULT_THREAD_INSTRUCTION_CONTEXT_TOGGLES,
  THREAD_INSTRUCTION_CONTEXT_OPTIONS,
  type ThreadInstructionContextToggleKey,
} from "~/lib/domain/value-objects/thread-instruction-context";
import {
  type SkillRegistryId,
} from "~/lib/domain/value-objects/skill-registry";
import type { ThreadSkillActivation } from "~/lib/contracts/skills/types";
import { useWorkspaceDesktopUpdater } from "~/lib/client/usecase/workspace/desktop-updater/use-desktop-updater";
import { useWorkspaceLayout } from "~/lib/client/usecase/workspace/layout/use-layout";
import { usePlaygroundSession } from "~/lib/client/usecase/workspace/playground-panel/use-playground-session";
import {
  useConfigPanelState,
} from "~/lib/client/usecase/workspace/config-panel/use-config-panel";
import {
  useWorkspaceConfigPanel,
} from "~/lib/client/usecase/workspace/config-panel/use-workspace-config-panel";
import { useWorkspaceRuntimeLogging } from "~/lib/client/usecase/workspace/runtime-logging/use-runtime-logging";
import { selectThreadOperationPhaseFlags } from "~/lib/client/usecase/workspace/threads/thread-guards";
import { findThreadStateById } from "~/lib/client/usecase/workspace/threads/thread-runtime";
import {
  createInitialThreadRequestStateCollection,
  readThreadRequestStateById,
  threadRequestStateReducer,
} from "~/lib/client/usecase/workspace/threads/thread-request-state-store";
import { chatApiClient } from "~/lib/client/infrastructure/api/chat-api-client";
import { instructionPatchesApiClient } from "~/lib/client/infrastructure/api/instruction-patches-api-client";
import {
  type SkillsCatalogSnapshot,
} from "~/lib/client/infrastructure/api/skills-api-client";
import { threadTitleApiClient } from "~/lib/client/infrastructure/api/thread-title-api-client";
import {
  useAzureSettings,
} from "~/lib/client/usecase/workspace/azure-settings/use-azure-settings";
import {
  buildUnauthenticatedPanelProps,
} from "~/lib/client/usecase/workspace/unauthenticated-panel/selectors";
import {
  readSkillCommandSuggestions,
} from "~/lib/client/usecase/workspace/skills-catalog/selectors";
import {
  type ChatCommandProvider,
} from "~/lib/client/usecase/workspace/chat-composer/menu-state";
import {
  type InstructionEnhanceComparison,
} from "~/lib/client/usecase/workspace/instruction-editor/instruction-enhance-comparison";
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
  useWorkspacePlayground,
} from "~/lib/client/usecase/workspace/playground-panel/use-workspace-playground";
import {
  createThreadStorageRuntime,
} from "~/lib/client/usecase/workspace/threads/storage-runtime";
import {
  useWorkspaceThreads,
} from "~/lib/client/usecase/workspace/threads/use-workspace-threads";
import type {
  ThreadRequestState,
} from "~/lib/client/usecase/workspace/threads/thread-request-state";

/**
 * Client runtime controller.
 * Owns interactive state for Playground/Threads/MCP/Settings and orchestrates server API calls.
 * This hook intentionally keeps state ownership centralized while delegating pure transforms
 * to modules under `~/lib/client/*`.
 */
export function useWorkspace() {
  // Primary runtime state for Client.
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
  } = usePlaygroundSession();
  const {
    activeMainTab,
    activeMainTabRef,
    setActiveMainTab,
  } = useConfigPanelState();
  const [threadRequestStateCollection, dispatchThreadRequestState] = useReducer(
    threadRequestStateReducer,
    undefined,
    createInitialThreadRequestStateCollection,
  );
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
    layoutRef,
    rightPaneWidth,
    isMainSplitterResizing,
    onMainSplitterPointerDown,
  } = useWorkspaceLayout();
  const threadOperationPhaseFlags =
    selectThreadOperationPhaseFlags(threadOperationPhase);
  const isLoadingThreads = threadOperationPhaseFlags.isLoadingThreads;
  const isSwitchingThread = threadOperationPhaseFlags.isSwitchingThread;
  const isCreatingThread = threadOperationPhaseFlags.isCreatingThread;
  const isDeletingThread = threadOperationPhaseFlags.isDeletingThread;
  const isClearingThread = threadOperationPhaseFlags.isClearingThread;
  const isRestoringThread = threadOperationPhaseFlags.isRestoringThread;
  const isThreadOperationBusy = threadOperationPhaseFlags.isThreadOperationBusy;

  // Mutable refs for request sequencing, optimistic state, and debounce timers.
  const activeAzureTenantIdRef = useRef("");
  const activeAzurePrincipalIdRef = useRef("");
  const activeWorkspaceUserKeyRef = useRef("");
  const selectedPlaygroundAzureConnectionIdRef = useRef("");
  const selectedPlaygroundAzureDeploymentNameRef = useRef("");
  const selectedUtilityAzureConnectionIdRef = useRef("");
  const selectedUtilityAzureDeploymentNameRef = useRef("");
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

  // Derived UI state and view models consumed by panel props.
  const activeThreadRequestState = readThreadRequestStateById(
    threadRequestStateCollection,
    activeThreadId,
  );
  const isSending = activeThreadRequestState.isSending;
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
  } = useAzureSettings({
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
  const {
    skillRegistryCatalogs,
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
  } = useSkillCatalog({
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
  const {
    desktopUpdaterStatus,
    desktopUpdaterActionState,
    isApplyingDesktopUpdate,
    handleApplyDesktopUpdate,
    handleCheckDesktopUpdates,
  } = useWorkspaceDesktopUpdater({
    setUiError,
    setSystemNotice,
    logClientError,
    logClientWarning,
  });

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
    refreshThreadTitleInBackground,
    sendMessage,
  } = workspaceThreads;

  const {
    configPanelProps,
  } = useWorkspaceConfigPanel({
    chrome: {
      activeMainTab,
      setActiveMainTab,
      isChatLocked,
    },
    settings: {
      theme,
      onThemeChange: handleThemeChange,
      isAzureAuthRequired,
      isSending,
      isStartingAzureLogin,
      onAzureLogin: handleAzureLogin,
      azureTenants,
      activeAzureTenantId: activeAzurePrincipal?.tenantId ?? "",
      isSwitchingAzureTenant,
      onAzureTenantChange: handleAzureTenantChange,
      isLoadingAzureConnections,
      isLoadingAzureDeployments: isLoadingPlaygroundAzureDeployments,
      isReloadingAzureCatalog,
      onAzureCatalogReload: handleReloadAzureCatalog,
      activeAzureConnection: activePlaygroundAzureConnection,
      activeAzurePrincipal,
      selectedPlaygroundAzureDeploymentName,
      isStartingAzureLogout,
      onAzureLogout: handleAzureLogout,
      azureTenantSwitchError,
      azureLogoutError,
      azureConnectionError,
      azureConnections,
      selectedUtilityAzureConnectionId,
      selectedUtilityAzureDeploymentName,
      utilityAzureDeployments: utilityAzureDeploymentNames,
      utilityReasoningEffort: effectiveUtilityReasoningEffort,
      utilityReasoningEffortOptions: effectiveUtilityReasoningEffortOptions,
      isUtilityReasoningEffortSupported,
      utilityAzureDeploymentError,
      onUtilityProjectChange: instructionEditor.handleUtilityProjectChange,
      onUtilityDeploymentChange:
        instructionEditor.handleUtilityDeploymentChange,
      onUtilityReasoningEffortChange:
        instructionEditor.handleUtilityReasoningEffortChange,
      isLoadingUtilityAzureDeployments,
    },
    mcpServers: {
      workspaceMcpServerProfileOptions:
        mcpProfiles.workspaceMcpServerProfileOptions,
      selectedWorkspaceMcpServerProfileCount:
        mcpProfiles.selectedWorkspaceMcpServerProfileCount,
      isSending,
      isActiveThreadArchived,
      isLoadingWorkspaceMcpServerProfiles:
        mcpProfiles.isLoadingWorkspaceMcpServerProfiles,
      isMutatingWorkspaceMcpServerProfiles:
        mcpProfiles.isMutatingWorkspaceMcpServerProfiles,
      workspaceMcpServerProfileError:
        mcpProfiles.workspaceMcpServerProfileError,
      handleToggleWorkspaceMcpServerProfile:
        mcpProfiles.handleToggleWorkspaceMcpServerProfile,
      handleEditWorkspaceMcpServerProfile:
        mcpProfiles.handleEditWorkspaceMcpServerProfile,
      handleDeleteWorkspaceMcpServerProfile:
        mcpProfiles.handleDeleteWorkspaceMcpServerProfile,
      handleReloadWorkspaceMcpServerProfiles:
        mcpProfiles.handleReloadWorkspaceMcpServerProfiles,
      isEditingMcpServer: mcpProfiles.isEditingMcpServer,
      editingMcpServerName: mcpProfiles.editingMcpServerName,
      mcpNameInput: mcpProfiles.mcpNameInput,
      setMcpNameInput: mcpProfiles.setMcpNameInput,
      mcpTransport: mcpProfiles.mcpTransport,
      setMcpTransport: mcpProfiles.setMcpTransport,
      setMcpFormError: mcpProfiles.setMcpFormError,
      mcpCommandInput: mcpProfiles.mcpCommandInput,
      setMcpCommandInput: mcpProfiles.setMcpCommandInput,
      mcpArgsInput: mcpProfiles.mcpArgsInput,
      setMcpArgsInput: mcpProfiles.setMcpArgsInput,
      mcpCwdInput: mcpProfiles.mcpCwdInput,
      setMcpCwdInput: mcpProfiles.setMcpCwdInput,
      mcpEnvInput: mcpProfiles.mcpEnvInput,
      setMcpEnvInput: mcpProfiles.setMcpEnvInput,
      mcpUrlInput: mcpProfiles.mcpUrlInput,
      setMcpUrlInput: mcpProfiles.setMcpUrlInput,
      mcpHeadersInput: mcpProfiles.mcpHeadersInput,
      setMcpHeadersInput: mcpProfiles.setMcpHeadersInput,
      mcpUseAzureAuthInput: mcpProfiles.mcpUseAzureAuthInput,
      setMcpUseAzureAuthInput: mcpProfiles.setMcpUseAzureAuthInput,
      mcpAzureAuthScopeInput: mcpProfiles.mcpAzureAuthScopeInput,
      setMcpAzureAuthScopeInput: mcpProfiles.setMcpAzureAuthScopeInput,
      mcpTimeoutSecondsInput: mcpProfiles.mcpTimeoutSecondsInput,
      setMcpTimeoutSecondsInput: mcpProfiles.setMcpTimeoutSecondsInput,
      handleAddMcpServer: mcpProfiles.handleAddMcpServer,
      handleCancelMcpServerEdit: mcpProfiles.handleCancelMcpServerEdit,
      isSavingMcpServer: mcpProfiles.isSavingMcpServer,
      mcpFormError: mcpProfiles.mcpFormError,
      mcpFormWarning: mcpProfiles.mcpFormWarning,
      setMcpFormWarning: mcpProfiles.setMcpFormWarning,
    },
    threads: {
      agentInstruction: instructionEditor.agentInstruction,
      instructionContextToggles: instructionEditor.instructionContextToggles,
      instructionEnhanceComparison:
        instructionEditor.instructionEnhanceComparison,
      isSending,
      isActiveThreadArchived,
      isEnhancingInstruction: instructionEditor.isEnhancingInstruction,
      isEnhancingInstructionForActiveThread:
        instructionEditor.isEnhancingInstructionForActiveThread,
      isSavingInstructionPrompt:
        instructionEditor.isSavingInstructionPrompt,
      canSaveAgentInstructionPrompt:
        instructionEditor.canSaveAgentInstructionPrompt,
      canEnhanceAgentInstruction:
        instructionEditor.canEnhanceAgentInstruction,
      canClearAgentInstruction: instructionEditor.canClearAgentInstruction,
      loadedInstructionFileName: instructionEditor.loadedInstructionFileName,
      instructionFileInputRef: instructionEditor.instructionFileInputRef,
      instructionFileError: instructionEditor.instructionFileError,
      instructionSaveError: instructionEditor.instructionSaveError,
      instructionSaveSuccess: instructionEditor.instructionSaveSuccess,
      instructionEnhanceError: instructionEditor.instructionEnhanceError,
      instructionEnhanceSuccess:
        instructionEditor.instructionEnhanceSuccess,
      clearInstructionSaveSuccess:
        instructionEditor.clearInstructionSaveSuccess,
      clearInstructionEnhanceSuccess:
        instructionEditor.clearInstructionEnhanceSuccess,
      handleInstructionContextToggleChange:
        instructionEditor.handleInstructionContextToggleChange,
      handleAgentInstructionChange:
        instructionEditor.handleAgentInstructionChange,
      handleOpenInstructionFilePicker:
        instructionEditor.handleOpenInstructionFilePicker,
      handleInstructionFileChange:
        instructionEditor.handleInstructionFileChange,
      handleSaveInstructionPrompt:
        instructionEditor.handleSaveInstructionPrompt,
      handleEnhanceInstruction:
        instructionEditor.handleEnhanceInstruction,
      handleClearInstruction: instructionEditor.handleClearInstruction,
      handleAdoptEnhancedInstruction:
        instructionEditor.handleAdoptEnhancedInstruction,
      handleAdoptOriginalInstruction:
        instructionEditor.handleAdoptOriginalInstruction,
      activeThreadOptions,
      archivedThreadOptions,
      activeThreadId,
      isLoadingThreads,
      isSwitchingThread,
      isCreatingThread,
      isDeletingThread,
      isClearingThread,
      isRestoringThread,
      threadError,
      handleThreadChange,
      handleCreateThread,
      handleThreadRename,
      handleThreadCancel,
      handleThreadLogicalDelete,
      handleThreadClear,
      handleThreadRestore,
    },
    skills: {
      threadSkillOptions,
      isLoadingSkills,
      isSending,
      isActiveThreadArchived,
      skillsError,
      skillsWarning,
      handleReloadSkills,
      handleToggleThreadSkill,
      clearSkillsWarning() {
        setSkillsWarning(null);
      },
      skillRegistryGroups,
      isMutatingSkillRegistries,
      skillRegistryError,
      skillRegistryWarning,
      skillRegistrySuccess,
      handleToggleRegistrySkill,
      clearSkillRegistryWarning() {
        setSkillRegistryWarning(null);
      },
      clearSkillRegistrySuccess() {
        setSkillRegistrySuccess(null);
      },
    },
  });
  const {
    playgroundPanelProps,
  } = useWorkspacePlayground({
    chatCommandProviders,
    runtime: {
      messages,
      isSending,
      sendProgressMessages,
      endOfMessagesRef,
      chatInputRef,
      pendingChatCommandCursorIndexRef,
      draft,
      chatComposerCursorIndex,
      setChatComposerCursorIndex,
      chatCommandHighlightedIndex,
      setChatCommandHighlightedIndex,
    },
    operationLogs: {
      mcpRpcLogs,
      activeTurnId,
      lastErrorTurnId,
    },
    composerView: {
      draft,
      draftAttachments,
      threadOperationPhase,
      isSending,
      isActiveThreadArchived,
      isChatLocked,
      isLoadingAzureConnections,
      isLoadingAzureDeployments: isLoadingPlaygroundAzureDeployments,
      hasActiveThreadId: activeThreadId.trim().length > 0,
      hasActivePlaygroundAzureConnection: !!activePlaygroundAzureConnection,
      hasSelectedPlaygroundAzureDeploymentName:
        selectedPlaygroundAzureDeploymentName.trim().length > 0,
      isSelectedPlaygroundReasoningEffortOptionAvailable,
      isPlaygroundReasoningEffortWebSearchCompatible,
    },
    composerHandlers: {
      isArchivedThread,
      readActiveThreadId: () => activeThreadIdRef.current,
      isChatLocked,
      isSending,
      isComposing,
      readDraft: () => draft,
      readDraftAttachments: () => draftAttachments,
      readChatAttachmentInput: () => chatAttachmentInputRef.current,
      setPendingChatCommandCursorIndex: (value) => {
        pendingChatCommandCursorIndexRef.current = value;
      },
      setDraft,
      setChatComposerCursorIndex,
      setChatCommandHighlightedIndex,
      setChatAttachmentError,
      setDraftAttachments,
      setThreadError,
      setActiveMainTab,
      sendMessage,
      logClientError,
    },
    controlHandlers: {
      isSending,
      isStartingAzureLogin,
      isSwitchingAzureTenant,
      isStartingAzureLogout,
      isLoadingAzureConnections,
      isLoadingPlaygroundAzureDeployments,
      isAzureAuthRequired,
      azureConnectionError,
      hasAzureConnections: azureConnections.length > 0,
      hasActivePlaygroundAzureConnection: !!activePlaygroundAzureConnection,
      hasPlaygroundAzureDeployments: playgroundAzureDeployments.length > 0,
      hasSelectedPlaygroundAzureDeploymentName:
        selectedPlaygroundAzureDeploymentName.trim().length > 0,
      isPlaygroundReasoningEffortSupported,
      selectedPlaygroundDeploymentCompatibleReasoningEffortOptions,
      effectivePlaygroundReasoningEffortOptions,
      reasoningEffort,
      setUiError,
      setSystemNotice,
      setActiveMainTab,
      setReasoningEffort,
      setWebSearchEnabled,
      clearAzureSessionStatus,
      markAzureAuthRequired,
      handleAzureLogin,
      handleSelectPlaygroundProject,
      handleSelectPlaygroundDeployment,
      loadAzureProjects,
    },
    panel: {
      messages,
      isSending,
      isThreadReadOnly: isActiveThreadArchived,
      desktopUpdaterStatus,
      desktopUpdaterActionState,
      isApplyingDesktopUpdate,
      handleCheckDesktopUpdates,
      handleApplyDesktopUpdate,
      activeThreadName: activeThreadNameInput,
      isThreadOperationBusy,
      isCreatingThread,
      handleCreateThread,
      handleThreadCancel,
      readActiveThreadId: () => activeThreadIdRef.current,
      sendProgressMessages,
      endOfMessagesRef,
      systemNotice,
      setSystemNotice,
      error,
      azureLoginError,
      chatInputRef,
      messageAttachmentInputRef: chatAttachmentInputRef,
      draft,
      messageAttachments: draftAttachments,
      messageAttachmentError: chatAttachmentError,
      setIsComposing,
      isChatLocked,
      isLoadingAzureConnections,
      isLoadingAzureDeployments: isLoadingPlaygroundAzureDeployments,
      isAzureAuthRequired,
      isStartingAzureLogin,
      isStartingAzureLogout,
      azureConnections,
      activeAzureConnectionId: activePlaygroundAzureConnection?.id ?? "",
      selectedAzureDeploymentName: selectedPlaygroundAzureDeploymentName,
      azureDeployments: playgroundAzureDeploymentNames,
      reasoningEffort,
      reasoningEffortOptions: effectivePlaygroundReasoningEffortOptions,
      isReasoningEffortSupported: isPlaygroundReasoningEffortSupported,
      webSearchEnabled,
      selectedThreadSkills,
      selectedMessageSkillActivations,
      onRemoveThreadSkill: handleRemoveThreadSkill,
      onRemoveMessageSkillActivation: handleRemoveMessageSkillActivation,
      mcpServers,
      onRemoveMcpServer: mcpProfiles.handleRemoveMcpServer,
    },
  });

  const unauthenticatedPanelProps = buildUnauthenticatedPanelProps({
    isStartingAzureLogin,
    onAzureLogin: handleAzureLogin,
  });

  return {
    screen: {
      theme,
      layout: {
        layoutRef,
        rightPaneWidth,
        isMainSplitterResizing,
        onMainSplitterPointerDown,
      },
      auth: {
        isAzureAuthRequired,
        unauthenticatedPanelProps,
      },
      config: {
        ...configPanelProps,
      },
      playground: playgroundPanelProps,
    },
  };
}
