/**
 * Workspace client usecase module.
 */
import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import type {
  ThemeMode,
  McpTransport,
  ReasoningEffort,
} from "~/lib/client/usecase/workspace/view-types";
import {
  DEFAULT_AGENT_INSTRUCTION,
  DEFAULT_WEB_SEARCH_ENABLED,
  THREAD_DEFAULT_NAME,
} from "~/lib/domain/value-objects/thread-defaults";
import {
  DEFAULT_THEME_MODE,
  THREAD_NAME_MAX_LENGTH,
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
  upsertThreadOperationLogEntry,
} from "~/lib/contracts/chat/operation-log";
import type { McpServerConfig } from "~/lib/contracts/mcp/profile";
import {
  buildWorkspaceMcpServerProfileOptions,
  selectWorkspaceMcpProfileViewModel,
} from "~/lib/client/usecase/workspace/mcp-profiles/selectors";
import {
  installGlobalClientErrorLogging,
} from "~/lib/client/infrastructure/browser/runtime-event-log-client";
import {
  cloneThreadEnvironment,
  cloneThreadInstructionContexts,
  buildThreadSaveSignature,
  cloneThreadOperationLogs,
  cloneMcpServers,
  cloneMessages,
  cloneThreadSkillActivations,
  hasThreadInteraction,
  hasThreadPersistableState,
  isThreadArchivedById,
  updateThreadStateCollectionById,
} from "~/lib/contracts/threads/state";
import { readThreadEnvironmentFromUnknown } from "~/lib/domain/value-objects/thread-environment";
import {
  DEFAULT_THREAD_INSTRUCTION_CONTEXT_TOGGLES,
  THREAD_INSTRUCTION_CONTEXT_OPTIONS,
  type ThreadInstructionContextToggleKey,
} from "~/lib/domain/value-objects/thread-instruction-context";
import type { ThreadState } from "~/lib/contracts/threads/types";
import {
  type SkillRegistryId,
} from "~/lib/domain/value-objects/skill-registry";
import type { ThreadSkillActivation } from "~/lib/contracts/skills/types";
import { createId } from "~/lib/client/usecase/workspace/ids";
import { useWorkspaceDesktopUpdater } from "~/lib/client/usecase/workspace/desktop-updater/use-desktop-updater";
import { useWorkspaceLayout } from "~/lib/client/usecase/workspace/layout/use-layout";
import { useWorkspaceThreadBackgroundEffects } from "~/lib/client/usecase/workspace/threads/background-effects";
import { createPlaygroundControlHandlers } from "~/lib/client/usecase/workspace/playground-panel/handlers";
import { usePlaygroundRuntime } from "~/lib/client/usecase/workspace/playground-panel/use-runtime";
import { usePlaygroundSession } from "~/lib/client/usecase/workspace/playground-panel/use-session";
import { buildConfigPanelProps } from "~/lib/client/usecase/workspace/config-panel/panel-props";
import {
  useConfigPanelState,
  useLockedConfigPanelTab,
} from "~/lib/client/usecase/workspace/config-panel/use-config-panel";
import { buildWorkspacePlaygroundPanelProps } from "~/lib/client/usecase/workspace/playground-panel/panel-props";
import { createWorkspaceRuntimeLogging } from "~/lib/client/usecase/workspace/runtime-logging/logger";
import { useInstructionEditor } from "~/lib/client/usecase/workspace/instruction-editor/use-editor";
import {
  canTransition,
  canStartThreadOperation,
  transitionThreadOperation,
  type ThreadOperationPhase,
} from "~/lib/client/usecase/workspace/threads/thread-operation-phase";
import {
  isThreadPhaseBlockingSend,
  selectThreadOperationPhaseFlags,
  shouldBlockThreadPersistence,
} from "~/lib/client/usecase/workspace/threads/thread-guards";
import { findThreadStateById } from "~/lib/client/usecase/workspace/threads/thread-runtime";
import {
  readThreadRequestStateById,
  workspaceInteractionReducer,
} from "~/lib/client/usecase/workspace/reducer";
import {
  createInitialWorkspaceInteractionState,
} from "~/lib/client/usecase/workspace/state";
import { chatApiClient } from "~/lib/client/infrastructure/api/chat-api-client";
import { instructionPatchesApiClient } from "~/lib/client/infrastructure/api/instruction-patches-api-client";
import {
  type SkillsCatalogSnapshot,
} from "~/lib/client/infrastructure/api/skills-api-client";
import { threadTitleApiClient } from "~/lib/client/infrastructure/api/thread-title-api-client";
import {
  useWorkspaceAzure,
} from "~/lib/client/usecase/workspace/azure-settings/use-workspace-azure";
import {
  buildUnauthenticatedPanelProps,
} from "~/lib/client/usecase/workspace/unauthenticated-panel/selectors";
import {
  readSkillCommandSuggestions,
} from "~/lib/client/usecase/workspace/skills-catalog/selectors";
import {
  createThreadLifecycleHandlers,
} from "~/lib/client/usecase/workspace/threads/thread-lifecycle-handlers";
import {
  createChatComposerHandlers,
} from "~/lib/client/usecase/workspace/chat-composer/handlers";
import {
  type ChatCommandProvider,
} from "~/lib/client/usecase/workspace/chat-composer/menu-state";
import {
  createInstructionEditingHandlers,
} from "~/lib/client/usecase/workspace/instruction-editor/instruction-editing-handlers";
import {
  createInstructionPromptHandlers,
} from "~/lib/client/usecase/workspace/instruction-editor/instruction-prompt-handlers";
import {
  selectInstructionEditorViewModel,
} from "~/lib/client/usecase/workspace/instruction-editor/selectors";
import {
  createMcpProfileHandlers,
} from "~/lib/client/usecase/workspace/mcp-profiles/handlers";
import { useMcpProfileForm } from "~/lib/client/usecase/workspace/mcp-profiles/use-form";
import {
  connectMcpServerToThread,
} from "~/lib/client/usecase/workspace/threads/thread-mcp-server-operations";
import {
  type InstructionEnhanceComparison,
  type ThreadRequestState,
} from "~/lib/client/usecase/workspace/types";
import {
  createThreadTitleController,
} from "~/lib/client/usecase/workspace/threads/thread-title-controller";
import {
  createSendMessageController,
} from "~/lib/client/usecase/workspace/chat-session/controller";
import {
  clearMcpServerEditState as clearMcpServerEditStateOperation,
  populateMcpServerFormForEdit as populateMcpServerFormForEditOperation,
  resetMcpServerFormInputs as resetMcpServerFormInputsOperation,
} from "~/lib/client/usecase/workspace/mcp-profiles/controller";
import {
  buildThreadStateFromCurrentState as buildThreadStateFromCurrentStateOperation,
  createLocalThreadState as createLocalThreadStateOperation,
  setThreadSaveSignatures as setThreadSaveSignaturesOperation,
  shouldPersistThreadState as shouldPersistThreadStateOperation,
} from "~/lib/client/usecase/workspace/threads/local-thread-state";
import {
  createThreadRequestStateController,
} from "~/lib/client/usecase/workspace/threads/request-state";
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
  selectPlaygroundComposerViewModel,
  selectPlaygroundOperationLogViewModel,
} from "~/lib/client/usecase/workspace/playground-panel/selectors";
import {
  useWorkspaceStorageRuntimes,
} from "~/lib/client/usecase/workspace/use-workspace-storage-runtimes";

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
  const {
    instructionFileInputRef,
    agentInstruction,
    setAgentInstruction,
    instructionContextToggles,
    setInstructionContextToggles,
    loadedInstructionFileName,
    setLoadedInstructionFileName,
    instructionFileError,
    setInstructionFileError,
    instructionSaveError,
    setInstructionSaveError,
    instructionSaveSuccess,
    setInstructionSaveSuccess,
    isSavingInstructionPrompt,
    setIsSavingInstructionPrompt,
    instructionEnhanceError,
    setInstructionEnhanceError,
    instructionEnhanceSuccess,
    setInstructionEnhanceSuccess,
    isEnhancingInstruction,
    setIsEnhancingInstruction,
    instructionEnhancingThreadId,
    setInstructionEnhancingThreadId,
    instructionEnhanceComparison,
    setInstructionEnhanceComparison,
    resetInstructionEditor,
    applyThreadInstructionState,
  } = useInstructionEditor();
  const {
    workspaceMcpServerProfilesRef,
    workspaceMcpServerProfiles,
    setWorkspaceMcpServerProfiles,
    writeWorkspaceMcpServerProfiles,
    mcpNameInput,
    setMcpNameInput,
    mcpUrlInput,
    setMcpUrlInput,
    mcpCommandInput,
    setMcpCommandInput,
    mcpArgsInput,
    setMcpArgsInput,
    mcpCwdInput,
    setMcpCwdInput,
    mcpEnvInput,
    setMcpEnvInput,
    mcpHeadersInput,
    setMcpHeadersInput,
    mcpUseAzureAuthInput,
    setMcpUseAzureAuthInput,
    mcpAzureAuthScopeInput,
    setMcpAzureAuthScopeInput,
    mcpTimeoutSecondsInput,
    setMcpTimeoutSecondsInput,
    mcpTransport,
    setMcpTransport,
    editingMcpServerId,
    setEditingMcpServerId,
    mcpFormError,
    setMcpFormError,
    mcpFormWarning,
    setMcpFormWarning,
    workspaceMcpServerProfileError,
    setWorkspaceMcpServerProfileError,
    isLoadingWorkspaceMcpServerProfiles,
    setIsLoadingWorkspaceMcpServerProfiles,
    isSavingMcpServer,
    setIsSavingMcpServer,
    isDeletingWorkspaceMcpServerProfile,
    setIsDeletingWorkspaceMcpServerProfile,
    resetMcpServerFormInputs,
    clearMcpServerEditState,
    populateMcpServerFormForEdit,
  } = useMcpProfileForm();
  const [workspaceInteractionState, dispatchWorkspaceInteraction] = useReducer(
    workspaceInteractionReducer,
    undefined,
    createInitialWorkspaceInteractionState,
  );
  const threadRequestStateById = workspaceInteractionState.threadRequestStateById;
  const {
    threads,
    setThreads,
    threadsRef,
    activeThreadId,
    setActiveThreadId,
    activeThreadIdRef,
    activeThreadNameInput,
    setActiveThreadNameInput,
    activeThreadNameInputRef,
    isSavingThread,
    setIsSavingThread,
    threadOperationPhase,
    setThreadOperationPhase,
    threadError,
    setThreadError,
    isApplyingThreadStateRef,
    isThreadsReadyRef,
    threadNameSaveTimeoutRef,
    threadSaveTimeoutRef,
    threadTitleRefreshTimeoutRef,
    threadLoadRequestSeqRef,
    threadSaveRequestSeqRef,
    threadSaveSignatureByIdRef,
    threadRequestStateByIdRef,
    threadSendAbortControllerByIdRef,
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
    clearThreadsState,
    beginThreadOperation,
    resetThreadOperationPhase,
    endThreadOperation,
    isArchivedThread,
    shouldPersistThreadState,
    createLocalThreadState,
    buildThreadStateFromCurrentState,
    setThreadSaveSignatures,
    applyThreadState,
    clearActiveThreadState,
    showThreadReloadPlaceholder,
  } = useThreadShell({
    threadRequestStateById,
    dispatchWorkspaceInteraction,
    readDefaultThreadMcpServers: () =>
      workspaceMcpServerProfilesRef.current.filter(
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
      agentInstruction,
      instructionContextToggles,
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
    resetInstructionEditor,
    applyThreadInstructionState,
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
    buildRuntimeLogContext,
    logClientError,
    logClientWarning,
    logClientInfo,
  } = createWorkspaceRuntimeLogging({
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
    workspaceInteractionState,
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
  } = useWorkspaceAzure({
    isSending,
    readIsThreadsReady: () => isThreadsReadyRef.current,
    readIsLoadingThreads: () => isLoadingThreads,
    setSystemNotice,
    activeAzureTenantIdRef,
    activeAzurePrincipalIdRef,
    activeWorkspaceUserKeyRef,
    selectedPlaygroundAzureConnectionIdRef,
    selectedPlaygroundAzureDeploymentNameRef,
    selectedUtilityAzureConnectionIdRef,
    selectedUtilityAzureDeploymentNameRef,
    clearWorkspaceMcpServerProfilesState,
    loadWorkspaceMcpServerProfiles,
    clearThreadsState,
    showThreadReloadPlaceholder,
    loadThreads,
    logClientError,
    logClientWarning,
    reasoningEffort,
    webSearchEnabled,
  });
  const isChatLocked = isAzureAuthRequired;
  const {
    canClearAgentInstruction,
    canSaveAgentInstructionPrompt,
    canEnhanceAgentInstruction,
    isEnhancingInstructionForActiveThread,
  } = useMemo(
    () =>
      selectInstructionEditorViewModel({
        agentInstruction,
        loadedInstructionFileName,
        instructionFileError,
        isEnhancingInstruction,
        instructionEnhancingThreadId,
        activeThreadId,
      }),
    [
      activeThreadId,
      agentInstruction,
      instructionEnhancingThreadId,
      instructionFileError,
      isEnhancingInstruction,
      loadedInstructionFileName,
    ],
  );
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
    activeWorkspaceUserKeyRef,
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
    activeChatCommandMatch,
    activeChatCommandProvider,
    activeChatCommandSuggestions,
    activeChatCommandHighlightIndex,
    activeChatCommandMenu,
  } = usePlaygroundRuntime({
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
    chatCommandProviders,
  });
  const {
    threadOperationLogsByTurnId,
    activeTurnOperationLogs,
    errorTurnOperationLogs,
  } = useMemo(
    () =>
      selectPlaygroundOperationLogViewModel({
        mcpRpcLogs,
        activeTurnId,
        lastErrorTurnId,
      }),
    [activeTurnId, lastErrorTurnId, mcpRpcLogs],
  );
  const {
    workspaceMcpServerProfileOptions,
    selectedWorkspaceMcpServerProfileCount,
    isEditingMcpServer,
    editingMcpServerName,
    isMutatingWorkspaceMcpServerProfiles,
  } = useMemo(
    () =>
      selectWorkspaceMcpProfileViewModel({
        workspaceMcpServerProfiles,
        activeMcpServers: mcpServers,
        editingMcpServerId,
        isSavingMcpServer,
        isDeletingWorkspaceMcpServerProfile,
      }),
    [
      editingMcpServerId,
      isDeletingWorkspaceMcpServerProfile,
      isSavingMcpServer,
      mcpServers,
      workspaceMcpServerProfiles,
    ],
  );
  const {
    draftAttachmentTotalSizeBytes,
    draftPdfAttachmentTotalSizeBytes,
    messageAttachmentAccept: chatAttachmentAccept,
    messageAttachmentFormatHint: chatAttachmentFormatHint,
    canSendMessage,
  } = useMemo(
    () =>
      selectPlaygroundComposerViewModel({
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
      }),
    [
      activeThreadId,
      activePlaygroundAzureConnection,
      draft,
      draftAttachments,
      isActiveThreadArchived,
      isChatLocked,
      isLoadingAzureConnections,
      isLoadingPlaygroundAzureDeployments,
      isPlaygroundReasoningEffortWebSearchCompatible,
      isSelectedPlaygroundReasoningEffortOptionAvailable,
      isSending,
      selectedPlaygroundAzureDeploymentName,
      threadOperationPhase,
    ],
  );

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

  useEffect(() => {
    return installGlobalClientErrorLogging(() =>
      buildRuntimeLogContext({
        source: "client",
      }),
    );
  }, []);

  useLockedConfigPanelTab({
    activeMainTab,
    isChatLocked,
    setActiveMainTab,
  });

  // Saved MCP / Skills loading flows.
  const {
    workspaceMcpProfileStorageRuntime,
    threadStorageRuntime,
  } = useWorkspaceStorageRuntimes({
    workspaceMcpProfile: {
      readActiveWorkspaceUserKey: () => activeWorkspaceUserKeyRef.current,
      readWorkspaceMcpServerProfiles: () => workspaceMcpServerProfilesRef.current,
      writeWorkspaceMcpServerProfiles,
      setWorkspaceMcpServerProfileError,
      setIsLoadingWorkspaceMcpServerProfiles,
      setEditingMcpServerId,
      setIsDeletingWorkspaceMcpServerProfile,
      markAzureAuthRequired,
      logClientError,
    },
    threadStorage: {
      persistence: {
        activeWorkspaceUserKeyRef,
        activeThreadIdRef,
        threadsRef,
        threadSaveSignatureByIdRef,
        threadSaveRequestSeqRef,
        setIsSavingThread,
        markAzureAuthRequired,
        setThreadError,
        updateThreadsState,
        setActiveThreadNameInput,
        shouldPersistThreadState,
        buildThreadStateFromCurrentState,
        clearThreadNameSaveTimeout,
        clearThreadSaveTimeout,
        logClientInfo,
        logClientError,
      },
      loading: {
        activeWorkspaceUserKeyRef,
        activeThreadIdRef,
        threadLoadRequestSeqRef,
        isThreadsReadyRef,
        clearThreadsState,
        beginLoadingThreadOperation: () => beginThreadOperation("loading"),
        endLoadingThreadOperation: () => endThreadOperation("loading"),
        setThreadError,
        markAzureAuthRequired,
        setThreadSaveSignatures,
        setThreadsState,
        pruneThreadRequestState: (validThreadIds) => {
          dispatchWorkspaceInteraction({
            type: "thread_request_state/prune",
            validThreadIds,
          });
        },
        applyThreadState,
        createLocalThreadState,
        logClientInfo,
        logClientError,
      },
    },
  });

  const threadTitleController = createThreadTitleController({
    activeThreadIdRef,
    activeThreadNameInputRef,
    activeAzureTenantIdRef,
    threadsRef,
    isArchivedThread,
    isChatLocked,
    isLoadingUtilityAzureDeployments,
    readActiveUtilityAzureConnection: () => activeUtilityAzureConnection,
    readSelectedUtilityAzureDeploymentName: () =>
      selectedUtilityAzureDeploymentName,
    isSelectedUtilityDeploymentAvailable: isUtilityDeploymentAvailable,
    readAgentInstruction: () => agentInstruction,
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
  });

  const sendMessageController = createSendMessageController({
    activeThreadIdRef,
    activeAzureTenantIdRef,
    threadsRef,
    readDraft: () => draft,
    readSelectedPlaygroundAzureDeploymentName: () =>
      selectedPlaygroundAzureDeploymentName,
    isArchivedThread,
    readThreadRequestState,
    readThreadOperationPhase: () => threadOperationPhase,
    isChatLocked,
    readActivePlaygroundAzureConnection: () => activePlaygroundAzureConnection,
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
    readAgentInstruction: () => agentInstruction,
    readInstructionContextToggles: () => instructionContextToggles,
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
    refreshThreadTitleInBackground,
    assignThreadSendAbortController,
    saveThreadStateToDatabase: threadStorageRuntime.saveThreadStateToDatabase,
    markAzureAuthRequired,
    sendMessage: (payload, sendOptions) =>
      chatApiClient.sendMessage(payload, sendOptions),
    appendThreadProgressMessage,
    appendThreadOperationLogToThreadState,
    applyThreadEnvironmentToThreadState,
    clearThreadSendAbortController,
    scheduleThreadStateSave: (threadId) => {
      window.setTimeout(() => {
        void threadStorageRuntime.saveThreadStateSilentlyIfNeeded(threadId);
      }, 0);
    },
  });

  async function refreshThreadTitleInBackground(options: {
    threadId: string;
    reason:
      | "first_message"
      | "instruction_update"
      | "utility_deployment_update";
    instructionOverride?: string;
  }): Promise<void> {
    await threadTitleController.refreshThreadTitleInBackground(options);
  }

  async function loadThreads(): Promise<void> {
    await threadStorageRuntime.loadThreads();
  }

  function clearWorkspaceMcpServerProfilesState(
    nextError?: string | null,
  ): void {
    workspaceMcpProfileStorageRuntime.clearWorkspaceMcpServerProfilesState(
      nextError,
    );
  }

  async function loadWorkspaceMcpServerProfiles(): Promise<void> {
    await workspaceMcpProfileStorageRuntime.loadWorkspaceMcpServerProfiles();
  }

  useWorkspaceThreadBackgroundEffects({
    activeThreadId,
    activeThreadNameInput,
    agentInstruction,
    instructionContextToggles,
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
    isThreadsReadyRef,
    isApplyingThreadStateRef,
    activeThreadIdRef,
    threadNameSaveTimeoutRef,
    threadSaveTimeoutRef,
    threadTitleRefreshTimeoutRef,
    threadSaveSignatureByIdRef,
    clearThreadNameSaveTimeout,
    clearThreadSaveTimeout,
    clearThreadTitleRefreshTimeout,
    readThreadById: (threadId) =>
      findThreadStateById(threadsRef.current, threadId) ?? undefined,
    isArchivedThread,
    isSelectedUtilityDeploymentAvailable: isUtilityDeploymentAvailable,
    buildThreadStateFromCurrentState,
    shouldPersistThreadState: (thread) => shouldPersistThreadState(thread),
    saveThreadStateToDatabase: threadStorageRuntime.saveThreadStateToDatabase,
    saveActiveThreadNameInBackground:
      threadStorageRuntime.saveActiveThreadNameInBackground,
    refreshThreadTitleInBackground,
  });

  // Thread lifecycle actions (load/create/rename/archive/switch).
  const {
    handleCreateThread,
    handleThreadRename,
    handleThreadCancel,
    handleThreadClear,
    handleThreadLogicalDelete,
    handleThreadRestore,
    handleThreadChange,
  } = createThreadLifecycleHandlers({
    isSending,
    threadOperationPhase,
    readThreads: () => threadsRef.current,
    readActiveThreadId: () => activeThreadIdRef.current,
    beginThreadOperation,
    endThreadOperation,
    readThreadRequestState,
    updateThreadStateById,
    updateThreadsState,
    hasSavedThreadSignature: (threadId) =>
      threadSaveSignatureByIdRef.current.has(threadId),
    setThreadsReady: () => {
      isThreadsReadyRef.current = true;
    },
    rememberThreadSaveSignature: (thread) => {
      threadSaveSignatureByIdRef.current.set(
        thread.id,
        buildThreadSaveSignature(thread),
      );
    },
    applyThreadState,
    clearActiveThreadState,
    buildThreadStateFromCurrentState,
    saveThreadStateToDatabase: threadStorageRuntime.saveThreadStateToDatabase,
    flushActiveThreadState: threadStorageRuntime.flushActiveThreadState,
    cancelThreadInProgressProcessing,
    createLocalThreadState,
    loadThreads: threadStorageRuntime.loadThreads,
    removeThreadRequestState: (threadId) => {
      dispatchWorkspaceInteraction({
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
  });

  // MCP save/connect and chat execution flow.
  function connectMcpServerToActiveThread(serverToConnect: McpServerConfig) {
    const activeId = activeThreadIdRef.current.trim();
    if (!activeId) {
      return;
    }

    updateThreadStateById(activeId, (thread) =>
      connectMcpServerToThread(thread, serverToConnect),
    );
  }

  async function sendMessage() {
    await sendMessageController.sendMessage();
  }

  const {
    handleReloadWorkspaceMcpServerProfiles,
    handleCancelMcpServerEdit,
    handleEditWorkspaceMcpServerProfile,
    handleDeleteWorkspaceMcpServerProfile,
    handleToggleWorkspaceMcpServerProfile,
    handleRemoveMcpServer,
    handleAddMcpServer,
  } = createMcpProfileHandlers({
    isArchivedThread,
    readActiveThreadId: () => activeThreadIdRef.current,
    readWorkspaceMcpServerProfiles: () => workspaceMcpServerProfilesRef.current,
    readActiveThreadMcpServers: () => mcpServers,
    readEditingMcpServerId: () => editingMcpServerId,
    isDeletingWorkspaceMcpServerProfile,
    setWorkspaceMcpServerProfileError,
    loadWorkspaceMcpServerProfiles,
    clearMcpServerEditState,
    setEditingMcpServerId,
    populateMcpServerFormForEdit,
    setMcpFormError,
    setMcpFormWarning,
    setIsDeletingWorkspaceMcpServerProfile,
    setIsSavingMcpServer,
    applyWorkspaceMcpServerProfiles:
      workspaceMcpProfileStorageRuntime.applyWorkspaceMcpServerProfiles,
    deleteWorkspaceMcpServerProfileFromConfig:
      workspaceMcpProfileStorageRuntime.deleteWorkspaceMcpServerProfileFromConfig,
    saveMcpServerToConfig: workspaceMcpProfileStorageRuntime.saveMcpServerToConfig,
    connectMcpServerToActiveThread,
    resetMcpServerFormInputs,
    updateThreadStateById,
    logClientError,
    logClientWarning,
    mcpFormState: {
      editingMcpServerId,
      mcpNameInput,
      mcpTransport,
      mcpUrlInput,
      mcpCommandInput,
      mcpArgsInput,
      mcpCwdInput,
      mcpEnvInput,
      mcpHeadersInput,
      mcpUseAzureAuthInput,
      mcpAzureAuthScopeInput,
      mcpTimeoutSecondsInput,
    },
  });

  const {
    handleSelectActiveChatCommandSuggestion,
    handleSubmit,
    handleInputKeyDown,
    handleDraftChange,
    handleInputSelect,
    handleOpenChatAttachmentPicker,
    handleChatAttachmentFileChange,
    handleRemoveDraftAttachment,
  } = createChatComposerHandlers({
    isArchivedThread,
    readActiveThreadId: () => activeThreadIdRef.current,
    isChatLocked,
    isSending,
    isComposing,
    readDraft: () => draft,
    readDraftAttachments: () => draftAttachments,
    readDraftAttachmentTotalSizeBytes: () => draftAttachmentTotalSizeBytes,
    readDraftPdfAttachmentTotalSizeBytes: () =>
      draftPdfAttachmentTotalSizeBytes,
    chatAttachmentFormatHint,
    readActiveChatCommandMatch: () => activeChatCommandMatch,
    readActiveChatCommandProvider: () => activeChatCommandProvider,
    readActiveChatCommandSuggestions: () => activeChatCommandSuggestions,
    readActiveChatCommandMenu: () => activeChatCommandMenu,
    readActiveChatCommandHighlightIndex: () =>
      activeChatCommandHighlightIndex,
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
  });

  const {
    handleInstructionContextToggleChange,
    handleAgentInstructionChange,
    handleOpenInstructionFilePicker,
    handleClearInstruction,
    handleInstructionFileChange,
  } = createInstructionEditingHandlers({
    isArchivedThread,
    readActiveThreadId: () => activeThreadIdRef.current,
    readInstructionFileInput: () => instructionFileInputRef.current,
    setInstructionContextToggles,
    setAgentInstruction,
    setLoadedInstructionFileName,
    setInstructionFileError,
    setInstructionSaveError,
    setInstructionSaveSuccess,
    setInstructionEnhanceError,
    setInstructionEnhanceSuccess,
    setInstructionEnhanceComparison,
    logClientError,
  });

  const {
    handleUtilityProjectChange,
    handleUtilityDeploymentChange,
    handleUtilityReasoningEffortChange,
    handleSaveInstructionPrompt,
    handleEnhanceInstruction,
    handleAdoptEnhancedInstruction,
    handleAdoptOriginalInstruction,
  } = createInstructionPromptHandlers({
    isArchivedThread,
    readActiveThreadId: () => activeThreadIdRef.current,
    readAgentInstruction: () => agentInstruction,
    readLoadedInstructionFileName: () => loadedInstructionFileName,
    readInstructionEnhanceComparison: () => instructionEnhanceComparison,
    isSavingInstructionPrompt,
    setIsSavingInstructionPrompt,
    isEnhancingInstruction,
    setIsEnhancingInstruction,
    setInstructionEnhancingThreadId,
    setLoadedInstructionFileName,
    setInstructionFileError,
    setInstructionSaveError,
    setInstructionSaveSuccess,
    setInstructionEnhanceError,
    setInstructionEnhanceSuccess,
    setInstructionEnhanceComparison,
    setAgentInstruction,
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
    refreshThreadTitleInBackground,
    logClientError,
  });

  const {
    handleChatProjectChange,
    handleChatDeploymentChange,
    handleReasoningEffortChange,
    handleWebSearchEnabledChange,
    handleChatAzureSelectorAction,
    handleCopyMessage,
    handleCopyMcpLog,
  } = createPlaygroundControlHandlers({
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
  });

  const configPanelProps = buildConfigPanelProps({
    activeMainTab,
    setActiveMainTab,
    isChatLocked,
    theme,
    handleThemeChange,
    isAzureAuthRequired,
    isSending,
    isStartingAzureLogin,
    handleAzureLogin,
    azureTenants,
    activeAzureTenantId: activeAzurePrincipal?.tenantId ?? "",
    isSwitchingAzureTenant,
    handleAzureTenantChange,
    isLoadingAzureConnections,
    isLoadingPlaygroundAzureDeployments,
    isLoadingUtilityAzureDeployments,
    isReloadingAzureCatalog,
    handleReloadAzureCatalog,
    activePlaygroundAzureConnection,
    activeAzurePrincipal,
    selectedPlaygroundAzureDeploymentName,
    isStartingAzureLogout,
    handleAzureLogout,
    azureTenantSwitchError,
    azureLogoutError,
    azureConnectionError,
    azureConnections,
    selectedUtilityAzureConnectionId,
    selectedUtilityAzureDeploymentName,
    utilityAzureDeploymentNames,
    effectiveUtilityReasoningEffort,
    effectiveUtilityReasoningEffortOptions,
    isUtilityReasoningEffortSupported,
    utilityAzureDeploymentError,
    handleUtilityProjectChange,
    handleUtilityDeploymentChange,
    handleUtilityReasoningEffortChange,
    workspaceMcpServerProfileOptions,
    selectedWorkspaceMcpServerProfileCount,
    isActiveThreadArchived,
    isLoadingWorkspaceMcpServerProfiles,
    isMutatingWorkspaceMcpServerProfiles,
    workspaceMcpServerProfileError,
    handleToggleWorkspaceMcpServerProfile,
    handleEditWorkspaceMcpServerProfile,
    handleDeleteWorkspaceMcpServerProfile,
    handleReloadWorkspaceMcpServerProfiles,
    isEditingMcpServer,
    editingMcpServerName,
    mcpNameInput,
    setMcpNameInput,
    mcpTransport,
    setMcpTransport,
    setMcpFormError,
    mcpCommandInput,
    setMcpCommandInput,
    mcpArgsInput,
    setMcpArgsInput,
    mcpCwdInput,
    setMcpCwdInput,
    mcpEnvInput,
    setMcpEnvInput,
    mcpUrlInput,
    setMcpUrlInput,
    mcpHeadersInput,
    setMcpHeadersInput,
    mcpUseAzureAuthInput,
    setMcpUseAzureAuthInput,
    mcpAzureAuthScopeInput,
    setMcpAzureAuthScopeInput,
    mcpTimeoutSecondsInput,
    setMcpTimeoutSecondsInput,
    handleAddMcpServer,
    handleCancelMcpServerEdit,
    isSavingMcpServer,
    mcpFormError,
    mcpFormWarning,
    setMcpFormWarning,
    agentInstruction,
    instructionContextToggles,
    instructionEnhanceComparison,
    isEnhancingInstruction,
    isEnhancingInstructionForActiveThread,
    isSavingInstructionPrompt,
    canSaveAgentInstructionPrompt,
    canEnhanceAgentInstruction,
    canClearAgentInstruction,
    loadedInstructionFileName,
    instructionFileInputRef,
    instructionFileError,
    instructionSaveError,
    instructionSaveSuccess,
    instructionEnhanceError,
    instructionEnhanceSuccess,
    setInstructionSaveSuccess,
    setInstructionEnhanceSuccess,
    handleInstructionContextToggleChange,
    handleAgentInstructionChange,
    handleOpenInstructionFilePicker,
    handleInstructionFileChange,
    handleSaveInstructionPrompt,
    handleEnhanceInstruction,
    handleClearInstruction,
    handleAdoptEnhancedInstruction,
    handleAdoptOriginalInstruction,
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
    threadSkillOptions,
    isLoadingSkills,
    skillsError,
    skillsWarning,
    handleReloadSkills,
    handleToggleThreadSkill,
    setSkillsWarning,
    skillRegistryGroups,
    isMutatingSkillRegistries,
    skillRegistryError,
    skillRegistryWarning,
    skillRegistrySuccess,
    handleToggleRegistrySkill,
    setSkillRegistryWarning,
    setSkillRegistrySuccess,
  });

  const playgroundPanelProps = buildWorkspacePlaygroundPanelProps({
    messages,
    threadOperationLogsByTurnId,
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
    onCopyMessage: handleCopyMessage,
    onCopyOperationLog: handleCopyMcpLog,
    sendProgressMessages,
    activeTurnOperationLogs,
    errorTurnOperationLogs,
    endOfMessagesRef,
    systemNotice,
    setSystemNotice,
    error,
    azureLoginError,
    onSubmit: handleSubmit,
    chatInputRef,
    messageAttachmentInputRef: chatAttachmentInputRef,
    messageAttachmentAccept: chatAttachmentAccept,
    messageAttachmentFormatHint: chatAttachmentFormatHint,
    draft,
    messageAttachments: draftAttachments,
    messageAttachmentError: chatAttachmentError,
    onDraftChange: handleDraftChange,
    onInputSelect: handleInputSelect,
    onOpenMessageAttachmentPicker: handleOpenChatAttachmentPicker,
    onMessageAttachmentFileChange: handleChatAttachmentFileChange,
    onRemoveMessageAttachment: handleRemoveDraftAttachment,
    onInputKeyDown: handleInputKeyDown,
    chatCommandMenu: activeChatCommandMenu,
    onSelectChatCommandSuggestion: handleSelectActiveChatCommandSuggestion,
    onHighlightChatCommandSuggestion: setChatCommandHighlightedIndex,
    setIsComposing,
    isChatLocked,
    isLoadingAzureConnections,
    isLoadingAzureDeployments: isLoadingPlaygroundAzureDeployments,
    isAzureAuthRequired,
    isStartingAzureLogin,
    isStartingAzureLogout,
    onChatAzureSelectorAction: handleChatAzureSelectorAction,
    azureConnections,
    activeAzureConnectionId: activePlaygroundAzureConnection?.id ?? "",
    onProjectChange: handleChatProjectChange,
    selectedAzureDeploymentName: selectedPlaygroundAzureDeploymentName,
    azureDeployments: playgroundAzureDeploymentNames,
    onDeploymentChange: handleChatDeploymentChange,
    reasoningEffort,
    reasoningEffortOptions: effectivePlaygroundReasoningEffortOptions,
    isReasoningEffortSupported: isPlaygroundReasoningEffortSupported,
    onReasoningEffortChange: handleReasoningEffortChange,
    webSearchEnabled,
    onWebSearchEnabledChange: handleWebSearchEnabledChange,
    canSendMessage,
    selectedThreadSkills,
    selectedMessageSkillActivations,
    onRemoveThreadSkill: handleRemoveThreadSkill,
    onRemoveMessageSkillActivation: handleRemoveMessageSkillActivation,
    mcpServers,
    onRemoveMcpServer: handleRemoveMcpServer,
  });

  const unauthenticatedPanelProps = buildUnauthenticatedPanelProps({
    isStartingAzureLogin,
    onAzureLogin: handleAzureLogin,
  });

  return {
    layoutRef,
    rightPaneWidth,
    isMainSplitterResizing,
    onMainSplitterPointerDown,
    isAzureAuthRequired,
    theme,
    unauthenticatedPanelProps,
    configPanelProps: {
      ...configPanelProps,
    },
    playgroundPanelProps,
  };
}
