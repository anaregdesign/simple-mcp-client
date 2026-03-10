/**
 * Workspace client usecase module.
 */
import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import type {
  ThemeMode,
  MainViewTab,
  McpTransport,
  ReasoningEffort,
} from "~/lib/client/usecase/workspace/view-types";
import {
  CHAT_ATTACHMENT_ALLOWED_EXTENSIONS,
  DEFAULT_AGENT_INSTRUCTION,
  DEFAULT_REASONING_EFFORT,
  DEFAULT_WEB_SEARCH_ENABLED,
  THREAD_DEFAULT_NAME,
} from "~/lib/constants/chat";
import {
  DEFAULT_THEME_MODE,
  INITIAL_THREAD_MESSAGES,
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
import {
  readChatCommandMatchAtCursor,
} from "~/lib/client/usecase/workspace/chat-composer/commands";
import type { ThreadMessage } from "~/lib/contracts/chat/messages";
import type {
  ThreadOperationLogEntry,
} from "~/lib/contracts/chat/operation-log";
import {
  buildThreadOperationLogsByTurnId,
  upsertThreadOperationLogEntry,
} from "~/lib/contracts/chat/operation-log";
import type { McpServerConfig } from "~/lib/contracts/mcp/profile";
import {
  buildWorkspaceMcpServerProfileOptions,
  countSelectedWorkspaceMcpServerProfileOptions,
} from "~/lib/client/usecase/workspace/workspace-mcp-server-profiles";
import {
  installGlobalClientErrorLogging,
} from "~/lib/client/infrastructure/browser/runtime-event-log-client";
import {
  buildThreadSummary,
} from "~/lib/contracts/threads/parsers";
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
  isThreadArchived,
  readThreadRuntimeStateById,
  updateThreadStateCollectionById,
} from "~/lib/contracts/threads/state";
import { readThreadEnvironmentFromUnknown } from "~/lib/contracts/threads/environment";
import {
  DEFAULT_THREAD_INSTRUCTION_CONTEXT_TOGGLES,
  THREAD_INSTRUCTION_CONTEXT_OPTIONS,
  type ThreadInstructionContextToggleKey,
} from "~/lib/contracts/threads/instruction-context";
import type { ThreadState, ThreadSummary, ThreadWritePayload } from "~/lib/contracts/threads/types";
import {
  type SkillRegistryId,
} from "~/lib/contracts/skills/registry";
import type {
  SkillCatalogEntry,
  SkillRegistryCatalog,
  ThreadSkillActivation,
} from "~/lib/contracts/skills/types";
import { getFileExtension } from "~/lib/client/usecase/workspace/files";
import { createId } from "~/lib/client/usecase/workspace/ids";
import { clampNumber } from "~/lib/client/usecase/workspace/numbers";
import { useWorkspaceDesktopUpdater } from "~/lib/client/usecase/workspace/use-workspace-desktop-updater";
import { useWorkspaceLayout } from "~/lib/client/usecase/workspace/use-workspace-layout";
import { useWorkspaceSkillCatalogEffects } from "~/lib/client/usecase/workspace/use-workspace-skill-catalog-effects";
import { useWorkspaceThreadBackgroundEffects } from "~/lib/client/usecase/workspace/use-workspace-thread-background-effects";
import { createPlaygroundControlHandlers } from "~/lib/client/usecase/workspace/playground-control-handlers";
import { buildWorkspaceConfigPanelProps } from "~/lib/client/usecase/workspace/workspace-config-panel-props";
import { buildWorkspacePlaygroundPanelProps } from "~/lib/client/usecase/workspace/workspace-playground-panel-props";
import { createWorkspaceRuntimeLogging } from "~/lib/client/usecase/workspace/workspace-runtime-logging";
import { deriveInstructionRuntimeUiState } from "~/lib/client/usecase/workspace/instruction-runtime";
import {
  canTransition,
  canStartThreadOperation,
  transitionThreadOperation,
  type ThreadOperationPhase,
} from "~/lib/client/usecase/workspace/thread-operation-phase";
import {
  canSendMessageByGuard,
  isThreadPhaseBlockingSend,
  selectThreadOperationPhaseFlags,
  shouldBlockThreadPersistence,
} from "~/lib/client/usecase/workspace/thread-guards";
import {
  buildThreadListOptions,
  findThreadStateById,
} from "~/lib/client/usecase/workspace/thread-runtime";
import {
  readThreadRequestStateById,
  workspaceInteractionReducer,
} from "~/lib/client/usecase/workspace/reducer";
import {
  createInitialWorkspaceInteractionState,
} from "~/lib/client/usecase/workspace/state";
import {
  executeSendMessageTransport,
} from "~/lib/client/usecase/workspace/send-message-usecase";
import {
  sendMessage as sendMessageOperation,
} from "~/lib/client/usecase/workspace/send-message-operations";
import { chatApiClient } from "~/lib/client/infrastructure/api/chat-api-client";
import { instructionPatchesApiClient } from "~/lib/client/infrastructure/api/instruction-patches-api-client";
import { mcpServersApiClient } from "~/lib/client/infrastructure/api/mcp-servers-api-client";
import {
  skillsApiClient,
  type SkillsCatalogSnapshot,
} from "~/lib/client/infrastructure/api/skills-api-client";
import { threadTitleApiClient } from "~/lib/client/infrastructure/api/thread-title-api-client";
import { threadsApiClient } from "~/lib/client/infrastructure/api/threads-api-client";
import {
  filterReasoningEffortOptionsForDeploymentCompatibility,
  filterReasoningEffortOptionsForWebSearch,
  includesAzureDeploymentName,
  isWebSearchCompatibleReasoningEffort,
  resolveEffectiveReasoningEffort,
  resolveSupportedReasoningEffortOptions,
} from "~/lib/client/usecase/workspace/azure-settings/selectors";
import { useAzureSettings } from "~/lib/client/usecase/workspace/azure-settings/use-azure-settings";
import {
  buildMessageSkillActivationOptions,
  buildSkillRegistryGroups,
  buildThreadSkillOptions,
  buildUnauthenticatedPanelProps,
  readSkillCommandSuggestions,
} from "~/lib/client/usecase/workspace/selectors";
import {
  createThreadLifecycleHandlers,
} from "~/lib/client/usecase/workspace/thread-lifecycle-handlers";
import {
  createChatComposerHandlers,
  type ChatCommandProvider,
  resizeChatComposerInput,
} from "~/lib/client/usecase/workspace/chat-composer-handlers";
import {
  createInstructionEditingHandlers,
} from "~/lib/client/usecase/workspace/instruction-editing-handlers";
import {
  createInstructionPromptHandlers,
} from "~/lib/client/usecase/workspace/instruction-prompt-handlers";
import {
  applySkillsCatalogSnapshot as applySkillsCatalogSnapshotOperation,
  handleReloadSkills as handleReloadSkillsOperation,
  loadAvailableSkills as loadAvailableSkillsOperation,
  updateSkillRegistrySkill as updateSkillRegistrySkillOperation,
} from "~/lib/client/usecase/workspace/skill-catalog-operations";
import {
  createMcpProfileHandlers,
} from "~/lib/client/usecase/workspace/mcp-profile-handlers";
import {
  connectMcpServerToThread,
} from "~/lib/client/usecase/workspace/thread-mcp-server-operations";
import {
  createSkillSelectionHandlers,
} from "~/lib/client/usecase/workspace/skill-selection-handlers";
import {
  applyWorkspaceMcpServerProfiles as applyWorkspaceMcpServerProfilesOperation,
  clearWorkspaceMcpServerProfilesState as clearWorkspaceMcpServerProfilesStateOperation,
  deleteWorkspaceMcpServerProfileFromConfig as deleteWorkspaceMcpServerProfileFromConfigOperation,
  loadWorkspaceMcpServerProfiles as loadWorkspaceMcpServerProfilesOperation,
  saveMcpServerToConfig as saveMcpServerToConfigOperation,
} from "~/lib/client/usecase/workspace/workspace-mcp-server-profile-operations";
import {
  flushActiveThreadState as flushActiveThreadStateOperation,
  saveActiveThreadNameInBackground as saveActiveThreadNameInBackgroundOperation,
  saveThreadStateSilentlyIfNeeded as saveThreadStateSilentlyIfNeededOperation,
  saveThreadStateToDatabase as saveThreadStateToDatabaseOperation,
} from "~/lib/client/usecase/workspace/thread-persistence-operations";
import {
  loadThreads as loadThreadsOperation,
} from "~/lib/client/usecase/workspace/thread-loading-operations";
import {
  refreshThreadTitleInBackground as refreshThreadTitleInBackgroundOperation,
} from "~/lib/client/usecase/workspace/thread-title-operations";
import {
  type InstructionEnhanceComparison,
  type ThreadRequestState,
} from "~/lib/client/usecase/workspace/types";

/**
 * Client runtime controller.
 * Owns interactive state for Playground/Threads/MCP/Settings and orchestrates server API calls.
 * This hook intentionally keeps state ownership centralized while delegating pure transforms
 * to modules under `~/lib/client/*`.
 */
export function useWorkspace() {
  // Primary runtime state for Client.
  const [draft, setDraft] = useState("");
  const [chatComposerCursorIndex, setChatComposerCursorIndex] = useState(0);
  const [chatCommandHighlightedIndex, setChatCommandHighlightedIndex] =
    useState(0);
  const [draftAttachments, setDraftAttachments] = useState<
    DraftChatAttachment[]
  >([]);
  const [chatAttachmentError, setChatAttachmentError] = useState<string | null>(
    null,
  );
  const [activeMainTab, setActiveMainTab] = useState<MainViewTab>("threads");
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>(
    DEFAULT_REASONING_EFFORT,
  );
  const [webSearchEnabled, setWebSearchEnabled] = useState(
    DEFAULT_WEB_SEARCH_ENABLED,
  );
  const [agentInstruction, setAgentInstruction] = useState(
    DEFAULT_AGENT_INSTRUCTION,
  );
  const [instructionContextToggles, setInstructionContextToggles] = useState(
    cloneThreadInstructionContexts(DEFAULT_THREAD_INSTRUCTION_CONTEXT_TOGGLES),
  );
  const [loadedInstructionFileName, setLoadedInstructionFileName] = useState<
    string | null
  >(null);
  const [instructionFileError, setInstructionFileError] = useState<
    string | null
  >(null);
  const [instructionSaveError, setInstructionSaveError] = useState<
    string | null
  >(null);
  const [instructionSaveSuccess, setInstructionSaveSuccess] = useState<
    string | null
  >(null);
  const [isSavingInstructionPrompt, setIsSavingInstructionPrompt] =
    useState(false);
  const [instructionEnhanceError, setInstructionEnhanceError] = useState<
    string | null
  >(null);
  const [instructionEnhanceSuccess, setInstructionEnhanceSuccess] = useState<
    string | null
  >(null);
  const [isEnhancingInstruction, setIsEnhancingInstruction] = useState(false);
  const [instructionEnhancingThreadId, setInstructionEnhancingThreadId] =
    useState("");
  const [instructionEnhanceComparison, setInstructionEnhanceComparison] =
    useState<InstructionEnhanceComparison | null>(null);
  const [workspaceMcpServerProfiles, setWorkspaceMcpServerProfiles] = useState<
    McpServerConfig[]
  >([]);
  const [mcpNameInput, setMcpNameInput] = useState("");
  const [mcpUrlInput, setMcpUrlInput] = useState("");
  const [mcpCommandInput, setMcpCommandInput] = useState("");
  const [mcpArgsInput, setMcpArgsInput] = useState("");
  const [mcpCwdInput, setMcpCwdInput] = useState("");
  const [mcpEnvInput, setMcpEnvInput] = useState("");
  const [mcpHeadersInput, setMcpHeadersInput] = useState("");
  const [mcpUseAzureAuthInput, setMcpUseAzureAuthInput] = useState(false);
  const [mcpAzureAuthScopeInput, setMcpAzureAuthScopeInput] = useState(
    MCP_DEFAULT_AZURE_AUTH_SCOPE,
  );
  const [mcpTimeoutSecondsInput, setMcpTimeoutSecondsInput] = useState(
    String(MCP_DEFAULT_TIMEOUT_SECONDS),
  );
  const [mcpTransport, setMcpTransport] = useState<McpTransport>(
    DEFAULT_MCP_TRANSPORT,
  );
  const [editingMcpServerId, setEditingMcpServerId] = useState("");
  const [mcpFormError, setMcpFormError] = useState<string | null>(null);
  const [mcpFormWarning, setMcpFormWarning] = useState<string | null>(null);
  const [workspaceMcpServerProfileError, setWorkspaceMcpServerProfileError] =
    useState<string | null>(null);
  const [
    isLoadingWorkspaceMcpServerProfiles,
    setIsLoadingWorkspaceMcpServerProfiles,
  ] = useState(false);
  const [isSavingMcpServer, setIsSavingMcpServer] = useState(false);
  const [
    isDeletingWorkspaceMcpServerProfile,
    setIsDeletingWorkspaceMcpServerProfile,
  ] = useState(false);
  const [workspaceInteractionState, dispatchWorkspaceInteraction] = useReducer(
    workspaceInteractionReducer,
    undefined,
    createInitialWorkspaceInteractionState,
  );
  const threadRequestStateById = workspaceInteractionState.threadRequestStateById;
  const [isComposing, setIsComposing] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);
  const [systemNotice, setSystemNotice] = useState<string | null>(null);
  const [threads, setThreads] = useState<ThreadState[]>([]);
  const [activeThreadId, setActiveThreadId] = useState("");
  const [activeThreadNameInput, setActiveThreadNameInput] = useState("");
  const [isSavingThread, setIsSavingThread] = useState(false);
  const [threadOperationPhase, setThreadOperationPhase] =
    useState<ThreadOperationPhase>("idle");
  const [threadError, setThreadError] = useState<string | null>(null);
  const [availableSkills, setAvailableSkills] = useState<SkillCatalogEntry[]>(
    [],
  );
  const [selectedMessageSkillActivations, setSelectedMessageSkillActivations] =
    useState<ThreadSkillActivation[]>([]);
  const [skillRegistryCatalogs, setSkillRegistryCatalogs] = useState<
    SkillRegistryCatalog[]
  >([]);
  const [isMutatingSkillRegistries, setIsMutatingSkillRegistries] =
    useState(false);
  const [skillRegistryError, setSkillRegistryError] = useState<string | null>(
    null,
  );
  const [skillRegistryWarning, setSkillRegistryWarning] = useState<
    string | null
  >(null);
  const [skillRegistrySuccess, setSkillRegistrySuccess] = useState<
    string | null
  >(null);
  const [isLoadingSkills, setIsLoadingSkills] = useState(false);
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [skillsWarning, setSkillsWarning] = useState<string | null>(null);
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
  const endOfMessagesRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingChatCommandCursorIndexRef = useRef<number | null>(null);
  const chatAttachmentInputRef = useRef<HTMLInputElement | null>(null);
  const instructionFileInputRef = useRef<HTMLInputElement | null>(null);
  const activeAzureTenantIdRef = useRef("");
  const activeAzurePrincipalIdRef = useRef("");
  const activeWorkspaceUserKeyRef = useRef("");
  const workspaceMcpServerProfileRequestSeqRef = useRef(0);
  const skillsRequestSeqRef = useRef(0);
  const lastManualSkillsReloadAtRef = useRef(0);
  const activeThreadIdRef = useRef("");
  const activeMainTabRef = useRef<MainViewTab>("threads");
  const selectedPlaygroundAzureConnectionIdRef = useRef("");
  const selectedPlaygroundAzureDeploymentNameRef = useRef("");
  const selectedUtilityAzureConnectionIdRef = useRef("");
  const selectedUtilityAzureDeploymentNameRef = useRef("");
  const activeThreadNameInputRef = useRef("");
  const isApplyingThreadStateRef = useRef(false);
  const isThreadsReadyRef = useRef(false);
  const threadNameSaveTimeoutRef = useRef<number | null>(null);
  const threadSaveTimeoutRef = useRef<number | null>(null);
  const threadTitleRefreshTimeoutRef = useRef<number | null>(null);
  const threadLoadRequestSeqRef = useRef(0);
  const threadSaveRequestSeqRef = useRef(0);
  const threadSaveSignatureByIdRef = useRef(new Map<string, string>());
  const threadRequestStateByIdRef = useRef<Record<string, ThreadRequestState>>(
    {},
  );
  const threadSendAbortControllerByIdRef = useRef(
    new Map<string, AbortController>(),
  );
  const workspaceMcpServerProfilesRef = useRef<McpServerConfig[]>([]);
  const threadsRef = useRef<ThreadState[]>([]);
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
    effectiveUtilityReasoningEffortOptions,
    effectiveUtilityReasoningEffort,
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
  } = useAzureSettings({
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
    clearWorkspaceMcpServerProfilesState: (nextError) => {
      clearWorkspaceMcpServerProfilesStateOperation(
        buildWorkspaceMcpServerProfileOperationDeps(),
        nextError,
      );
    },
    loadWorkspaceMcpServerProfiles: async () => {
      await loadWorkspaceMcpServerProfilesOperation(
        buildWorkspaceMcpServerProfileOperationDeps(),
      );
    },
    clearThreadsState,
    showThreadReloadPlaceholder,
    loadThreads,
    logClientError,
    logClientWarning,
  });
  const isChatLocked = isAzureAuthRequired;
  const instructionRuntimeUiState = deriveInstructionRuntimeUiState({
    agentInstruction,
    loadedInstructionFileName,
    instructionFileError,
  });
  const canClearAgentInstruction =
    instructionRuntimeUiState.hasInstructionInteraction;
  const canSaveAgentInstructionPrompt =
    instructionRuntimeUiState.canSaveAgentInstructionPrompt;
  const canEnhanceAgentInstruction =
    instructionRuntimeUiState.canEnhanceAgentInstruction;
  const selectedPlaygroundAzureDeployment = playgroundAzureDeployments.find(
    (deployment) => deployment.name === selectedPlaygroundAzureDeploymentName,
  );
  const selectedUtilityAzureDeployment = utilityAzureDeployments.find(
    (deployment) => deployment.name === selectedUtilityAzureDeploymentName,
  );
  const selectedPlaygroundDeploymentReasoningEffortOptions =
    resolveSupportedReasoningEffortOptions(
      selectedPlaygroundAzureDeployment?.reasoningEffortOptions ?? [],
    );
  const selectedPlaygroundDeploymentCompatibleReasoningEffortOptions =
    filterReasoningEffortOptionsForDeploymentCompatibility(
      selectedPlaygroundDeploymentReasoningEffortOptions,
      selectedPlaygroundAzureDeploymentName,
    );
  const isPlaygroundReasoningEffortSupported =
    selectedPlaygroundDeploymentCompatibleReasoningEffortOptions.length > 0;
  const effectivePlaygroundReasoningEffortOptions: ReasoningEffort[] =
    isPlaygroundReasoningEffortSupported
      ? filterReasoningEffortOptionsForWebSearch(
          selectedPlaygroundDeploymentCompatibleReasoningEffortOptions,
          webSearchEnabled,
        )
      : [DEFAULT_REASONING_EFFORT];
  const isSelectedPlaygroundReasoningEffortOptionAvailable =
    !isPlaygroundReasoningEffortSupported ||
    effectivePlaygroundReasoningEffortOptions.includes(reasoningEffort);
  const isPlaygroundReasoningEffortWebSearchCompatible =
    !webSearchEnabled ||
    !isPlaygroundReasoningEffortSupported ||
    isWebSearchCompatibleReasoningEffort(reasoningEffort);
  const sendProgressMessages = activeThreadRequestState.sendProgressMessages;
  const activeTurnId = activeThreadRequestState.activeTurnId;
  const lastErrorTurnId = activeThreadRequestState.lastErrorTurnId;
  const error = uiError ?? activeThreadRequestState.error;
  const activeThreadRuntimeState = useMemo(
    () => readThreadRuntimeStateById(threads, activeThreadId),
    [activeThreadId, threads],
  );
  const activeThreadState = activeThreadRuntimeState.activeThreadState;
  const messages =
    activeThreadState !== null
      ? activeThreadRuntimeState.messages
      : [...INITIAL_THREAD_MESSAGES];
  const mcpServers = activeThreadRuntimeState.mcpServers;
  const mcpRpcLogs = activeThreadRuntimeState.mcpRpcLogs;
  const selectedThreadSkills = activeThreadRuntimeState.skillSelections;
  const threadOperationLogsByTurnId = useMemo(
    () => buildThreadOperationLogsByTurnId(mcpRpcLogs),
    [mcpRpcLogs],
  );
  const activeTurnOperationLogs = useMemo(
    () =>
      activeTurnId ? (threadOperationLogsByTurnId.get(activeTurnId) ?? []) : [],
    [activeTurnId, threadOperationLogsByTurnId],
  );
  const errorTurnOperationLogs = useMemo(
    () =>
      lastErrorTurnId
        ? (threadOperationLogsByTurnId.get(lastErrorTurnId) ?? [])
        : [],
    [lastErrorTurnId, threadOperationLogsByTurnId],
  );
  const workspaceMcpServerProfileOptions = useMemo(
    () =>
      buildWorkspaceMcpServerProfileOptions(
        workspaceMcpServerProfiles,
        mcpServers,
      ),
    [workspaceMcpServerProfiles, mcpServers],
  );
  const editingMcpServer =
    editingMcpServerId.trim().length > 0
      ? (workspaceMcpServerProfiles.find(
          (server) => server.id === editingMcpServerId,
        ) ?? null)
      : null;
  const isEditingMcpServer = editingMcpServer !== null;
  const editingMcpServerName = editingMcpServer?.name ?? null;
  const isMutatingWorkspaceMcpServerProfiles =
    isSavingMcpServer || isDeletingWorkspaceMcpServerProfile;
  const selectedWorkspaceMcpServerProfileCount = useMemo(
    () =>
      countSelectedWorkspaceMcpServerProfileOptions(
        workspaceMcpServerProfileOptions,
      ),
    [workspaceMcpServerProfileOptions],
  );
  const draftAttachmentTotalSizeBytes = draftAttachments.reduce(
    (sum, attachment) => sum + attachment.sizeBytes,
    0,
  );
  const draftPdfAttachmentTotalSizeBytes = draftAttachments.reduce(
    (sum, attachment) =>
      sum +
      (getFileExtension(attachment.name) === "pdf" ? attachment.sizeBytes : 0),
    0,
  );
  const chatAttachmentAccept = [
    ...Array.from(
      CHAT_ATTACHMENT_ALLOWED_EXTENSIONS,
      (extension) => `.${extension}`,
    ),
  ].join(",");
  const chatAttachmentFormatHint =
    "Code Interpreter supported files (.pdf, .csv, .xlsx, .docx, .png, ...)";
  const threadSummaries: ThreadSummary[] = threads.map((thread) =>
    buildThreadSummary(thread),
  );
  const isActiveThreadArchived = isThreadArchived(activeThreadState);
  const isEnhancingInstructionForActiveThread =
    isEnhancingInstruction &&
    instructionEnhancingThreadId.length > 0 &&
    instructionEnhancingThreadId === activeThreadId;
  const activeThreadSummaries = threadSummaries.filter(
    (thread) => thread.deletedAt === null,
  );
  const archivedThreadSummaries = threadSummaries.filter(
    (thread) => thread.deletedAt !== null,
  );
  const activeThreadOptions = buildThreadListOptions({
    summaries: activeThreadSummaries,
    threadRequestStateById,
    renameActiveThreadId: activeThreadId,
    activeThreadNameInput,
  });
  const archivedThreadOptions = buildThreadListOptions({
    summaries: archivedThreadSummaries,
    threadRequestStateById,
  });
  const availableSkillByLocation = useMemo(
    () =>
      new Map(availableSkills.map((skill) => [skill.location, skill] as const)),
    [availableSkills],
  );
  const threadSkillOptions = useMemo(() => {
    return buildThreadSkillOptions({
      availableSkills,
      selectedThreadSkills,
    });
  }, [availableSkills, selectedThreadSkills]);
  const messageSkillActivationOptions = useMemo(() => {
    return buildMessageSkillActivationOptions({
      availableSkills,
      selectedMessageSkillActivations,
    });
  }, [availableSkills, selectedMessageSkillActivations]);
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
  const chatCommandKeywords = chatCommandProviders.map(
    (provider) => provider.keyword,
  );
  const effectiveChatComposerCursorIndex =
    chatInputRef.current?.selectionStart ?? chatComposerCursorIndex;
  const activeChatCommandMatch = readChatCommandMatchAtCursor({
    value: draft,
    cursorIndex: effectiveChatComposerCursorIndex,
    keywords: chatCommandKeywords,
  });
  const activeChatCommandProvider = activeChatCommandMatch
    ? (chatCommandProviders.find(
        (provider) => provider.keyword === activeChatCommandMatch.keyword,
      ) ?? null)
    : null;
  const activeChatCommandSuggestions =
    activeChatCommandMatch && activeChatCommandProvider
      ? activeChatCommandProvider.readSuggestions(activeChatCommandMatch.query)
      : [];
  const activeChatCommandHighlightIndex =
    activeChatCommandSuggestions.length > 0
      ? clampNumber(
          chatCommandHighlightedIndex,
          0,
          activeChatCommandSuggestions.length - 1,
        )
      : 0;
  const activeChatCommandMenu =
    activeChatCommandMatch && activeChatCommandProvider
      ? {
          keyword: activeChatCommandMatch.keyword,
          query: activeChatCommandMatch.query,
          emptyHint: activeChatCommandProvider.emptyHint,
          highlightedIndex: activeChatCommandHighlightIndex,
          suggestions: activeChatCommandSuggestions,
        }
      : null;
  const skillRegistryGroups = useMemo(
    () => buildSkillRegistryGroups(skillRegistryCatalogs),
    [skillRegistryCatalogs],
  );
  const canSendMessage = canSendMessageByGuard({
    threadOperationPhase,
    isSending,
    isActiveThreadArchived,
    isChatLocked,
    isLoadingAzureConnections,
    isLoadingPlaygroundAzureDeployments,
    hasActiveThreadId: activeThreadId.trim().length > 0,
    hasActivePlaygroundAzureConnection: !!activePlaygroundAzureConnection,
    hasSelectedPlaygroundAzureDeploymentName:
      selectedPlaygroundAzureDeploymentName.trim().length > 0,
    isSelectedPlaygroundReasoningEffortOptionAvailable,
    isPlaygroundReasoningEffortWebSearchCompatible,
    hasDraftContent: draft.trim().length > 0,
  });

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

  useWorkspaceSkillCatalogEffects({
    activeAzurePrincipal,
    isAzureAuthRequired,
    skillRegistryError,
    skillsError,
    loadAvailableSkills,
  });

  // Keep refs synchronized with state to avoid stale closures in async handlers.
  useEffect(() => {
    activeMainTabRef.current = activeMainTab;
  }, [activeMainTab]);

  useEffect(() => {
    return installGlobalClientErrorLogging(() =>
      buildRuntimeLogContext({
        source: "client",
      }),
    );
  }, []);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending, sendProgressMessages]);

  useEffect(() => {
    const input = chatInputRef.current;
    if (!input) {
      return;
    }

    resizeChatComposerInput(input);
  }, [draft]);

  useEffect(() => {
    const pendingCursorIndex = pendingChatCommandCursorIndexRef.current;
    if (pendingCursorIndex === null) {
      return;
    }

    const input = chatInputRef.current;
    if (!input) {
      return;
    }

    const nextCursorIndex = clampNumber(pendingCursorIndex, 0, draft.length);
    input.focus();
    input.setSelectionRange(nextCursorIndex, nextCursorIndex);
    pendingChatCommandCursorIndexRef.current = null;
    setChatComposerCursorIndex(nextCursorIndex);
  }, [draft]);

  useEffect(() => {
    setChatCommandHighlightedIndex(0);
  }, [
    activeChatCommandMatch?.keyword,
    activeChatCommandMatch?.query,
    activeChatCommandMatch?.rangeStart,
    activeChatCommandMatch?.rangeEnd,
  ]);

  useEffect(() => {
    if (activeChatCommandSuggestions.length === 0) {
      setChatCommandHighlightedIndex(0);
      return;
    }

    setChatCommandHighlightedIndex((current) =>
      clampNumber(current, 0, activeChatCommandSuggestions.length - 1),
    );
  }, [activeChatCommandSuggestions.length]);

  useEffect(() => {
    if (isChatLocked && activeMainTab !== "settings") {
      setActiveMainTab("settings");
    }
  }, [activeMainTab, isChatLocked]);

  useEffect(() => {
    if (!editingMcpServerId) {
      return;
    }

    const targetExists = workspaceMcpServerProfiles.some(
      (server) => server.id === editingMcpServerId,
    );
    if (!targetExists) {
      clearMcpServerEditState();
    }
  }, [editingMcpServerId, workspaceMcpServerProfiles]);

  useEffect(() => {
    activeThreadIdRef.current = activeThreadId;
  }, [activeThreadId]);

  useEffect(() => {
    activeThreadNameInputRef.current = activeThreadNameInput;
  }, [activeThreadNameInput]);

  useEffect(() => {
    threadRequestStateByIdRef.current = threadRequestStateById;
  }, [threadRequestStateById]);

  useEffect(() => {
    workspaceMcpServerProfilesRef.current = workspaceMcpServerProfiles;
  }, [workspaceMcpServerProfiles]);

  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);

  // Saved MCP / Skills loading flows.
  function buildWorkspaceMcpServerProfileOperationDeps() {
    return {
      readActiveWorkspaceUserKey: () => activeWorkspaceUserKeyRef.current,
      nextWorkspaceMcpServerProfileRequestSeq: () => {
        const requestSeq = workspaceMcpServerProfileRequestSeqRef.current + 1;
        workspaceMcpServerProfileRequestSeqRef.current = requestSeq;
        return requestSeq;
      },
      readWorkspaceMcpServerProfileRequestSeq: () =>
        workspaceMcpServerProfileRequestSeqRef.current,
      readWorkspaceMcpServerProfiles: () => workspaceMcpServerProfilesRef.current,
      writeWorkspaceMcpServerProfiles: (profiles: McpServerConfig[]) => {
        workspaceMcpServerProfilesRef.current = profiles;
        setWorkspaceMcpServerProfiles(profiles);
      },
      setWorkspaceMcpServerProfileError,
      setIsLoadingWorkspaceMcpServerProfiles,
      setEditingMcpServerId,
      setIsDeletingWorkspaceMcpServerProfile,
      markAzureAuthRequired,
      loadProfiles: (options: { onAuthRequired?: () => void }) =>
        mcpServersApiClient.loadProfiles(options),
      saveProfile: (
        server: McpServerConfig,
        options: {
          isUpdate?: boolean;
          onAuthRequired?: () => void;
        },
      ) => mcpServersApiClient.saveProfile(server, options),
      deleteProfile: (
        serverId: string,
        options: {
          onAuthRequired?: () => void;
        },
      ) => mcpServersApiClient.deleteProfile(serverId, options),
      logClientError,
    };
  }

  function buildSkillCatalogOperationDeps() {
    return {
      readActiveWorkspaceUserKey: () => activeWorkspaceUserKeyRef.current,
      nextSkillsRequestSeq: () => {
        const requestSeq = skillsRequestSeqRef.current + 1;
        skillsRequestSeqRef.current = requestSeq;
        return requestSeq;
      },
      readSkillsRequestSeq: () => skillsRequestSeqRef.current,
      readLastManualReloadAt: () => lastManualSkillsReloadAtRef.current,
      setLastManualReloadAt: (value: number) => {
        lastManualSkillsReloadAtRef.current = value;
      },
      markAzureAuthRequired,
      resolveAzureBackgroundSuccess,
      setAvailableSkills,
      setSkillRegistryCatalogs,
      setSkillsError,
      setSkillsWarning,
      setSkillRegistryError,
      setSkillRegistryWarning,
      setSkillRegistrySuccess,
      setIsLoadingSkills,
      setIsMutatingSkillRegistries,
      loadSkills: (options: {
        forceRefresh?: boolean;
        onAuthRequired?: () => void;
      }) => skillsApiClient.loadSkills(options),
      updateRegistrySkill: (options: {
        action: "install_registry_skill" | "delete_registry_skill";
        registryId: SkillRegistryId;
        skillName: string;
        onAuthRequired?: () => void;
      }) => skillsApiClient.updateRegistrySkill(options),
      logClientError,
    };
  }

  async function loadAvailableSkills(
    options: {
      clearStatus?: boolean;
      forceRefresh?: boolean;
    } = {},
  ): Promise<void> {
    await loadAvailableSkillsOperation(buildSkillCatalogOperationDeps(), options);
  }

  function applySkillsCatalogSnapshot(snapshot: SkillsCatalogSnapshot) {
    applySkillsCatalogSnapshotOperation(
      buildSkillCatalogOperationDeps(),
      snapshot,
    );
  }

  async function updateSkillRegistrySkill(options: {
    action: "install_registry_skill" | "delete_registry_skill";
    registryId: SkillRegistryId;
    skillName: string;
  }): Promise<void> {
    await updateSkillRegistrySkillOperation(
      buildSkillCatalogOperationDeps(),
      options,
    );
  }

  function resetMcpServerFormInputs() {
    setMcpNameInput("");
    setMcpUrlInput("");
    setMcpCommandInput("");
    setMcpArgsInput("");
    setMcpCwdInput("");
    setMcpEnvInput("");
    setMcpHeadersInput("");
    setMcpUseAzureAuthInput(false);
    setMcpAzureAuthScopeInput(MCP_DEFAULT_AZURE_AUTH_SCOPE);
    setMcpTimeoutSecondsInput(String(MCP_DEFAULT_TIMEOUT_SECONDS));
    setMcpTransport(DEFAULT_MCP_TRANSPORT);
  }

  function clearMcpServerEditState() {
    setEditingMcpServerId("");
    resetMcpServerFormInputs();
    setMcpFormError(null);
    setMcpFormWarning(null);
  }

  function populateMcpServerFormForEdit(server: McpServerConfig) {
    setMcpNameInput(server.name);
    setMcpTransport(server.transport);
    if (server.transport === "stdio") {
      setMcpCommandInput(server.command);
      setMcpArgsInput(
        server.args.length > 0 ? JSON.stringify(server.args) : "",
      );
      setMcpCwdInput(server.cwd ?? "");
      setMcpEnvInput(
        Object.entries(server.env)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, value]) => `${key}=${value}`)
          .join("\n"),
      );
      setMcpUrlInput("");
      setMcpHeadersInput("");
      setMcpUseAzureAuthInput(false);
      setMcpAzureAuthScopeInput(MCP_DEFAULT_AZURE_AUTH_SCOPE);
      setMcpTimeoutSecondsInput(String(MCP_DEFAULT_TIMEOUT_SECONDS));
      return;
    }

    setMcpUrlInput(server.url);
    setMcpHeadersInput(
      Object.entries(server.headers)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => `${key}=${value}`)
        .join("\n"),
    );
    setMcpUseAzureAuthInput(server.useAzureAuth);
    setMcpAzureAuthScopeInput(server.azureAuthScope);
    setMcpTimeoutSecondsInput(String(server.timeoutSeconds));
    setMcpCommandInput("");
    setMcpArgsInput("");
    setMcpCwdInput("");
    setMcpEnvInput("");
  }

  function clearThreadNameSaveTimeout() {
    const timeoutId = threadNameSaveTimeoutRef.current;
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
      threadNameSaveTimeoutRef.current = null;
    }
  }

  function clearThreadTitleRefreshTimeout() {
    const timeoutId = threadTitleRefreshTimeoutRef.current;
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
      threadTitleRefreshTimeoutRef.current = null;
    }
  }

  function clearThreadSaveTimeout() {
    const timeoutId = threadSaveTimeoutRef.current;
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
      threadSaveTimeoutRef.current = null;
    }
  }

  function setThreadsState(nextThreads: ThreadState[]): void {
    threadsRef.current = nextThreads;
    setThreads(nextThreads);
  }

  function updateThreadsState(
    updater: (current: ThreadState[]) => ThreadState[],
  ): ThreadState[] {
    const nextThreads = updater(threadsRef.current);
    threadsRef.current = nextThreads;
    setThreads(nextThreads);
    return nextThreads;
  }

  function clearThreadsState(nextError: string | null = null) {
    clearThreadTitleRefreshTimeout();
    clearThreadNameSaveTimeout();
    clearThreadSaveTimeout();
    for (const abortController of threadSendAbortControllerByIdRef.current.values()) {
      abortController.abort();
    }
    threadSendAbortControllerByIdRef.current.clear();
    isThreadsReadyRef.current = false;
    activeThreadIdRef.current = "";
    isApplyingThreadStateRef.current = false;
    threadSaveSignatureByIdRef.current.clear();
    setThreadsState([]);
    setActiveThreadId("");
    setActiveThreadNameInput("");
    setThreadError(nextError);
    resetThreadOperationPhase();
    setIsSavingThread(false);
    setSelectedMessageSkillActivations([]);
    setReasoningEffort(DEFAULT_REASONING_EFFORT);
    setWebSearchEnabled(DEFAULT_WEB_SEARCH_ENABLED);
    setAgentInstruction(DEFAULT_AGENT_INSTRUCTION);
    setInstructionContextToggles(
      cloneThreadInstructionContexts(
        DEFAULT_THREAD_INSTRUCTION_CONTEXT_TOGGLES,
      ),
    );
    setLoadedInstructionFileName(null);
    setInstructionFileError(null);
    setInstructionSaveError(null);
    setInstructionSaveSuccess(null);
    setInstructionEnhanceError(null);
    setInstructionEnhanceSuccess(null);
    setInstructionEnhancingThreadId("");
    setInstructionEnhanceComparison(null);
    setDraft("");
    setDraftAttachments([]);
    setChatAttachmentError(null);
    setUiError(null);
    setSystemNotice(null);
    dispatchWorkspaceInteraction({
      type: "thread_request_state/reset_all",
    });
    setIsComposing(false);
  }

  function beginThreadOperation(
    phase: Exclude<ThreadOperationPhase, "idle">,
  ): boolean {
    if (
      !canTransition(threadOperationPhase, {
        type: "start",
        phase,
      })
    ) {
      return false;
    }

    setThreadOperationPhase(
      (current) =>
        transitionThreadOperation(current, {
          type: "start",
          phase,
        }).to,
    );
    return true;
  }

  function resetThreadOperationPhase(): void {
    setThreadOperationPhase(
      (current) =>
        transitionThreadOperation(current, {
          type: "reset",
        }).to,
    );
  }

  function endThreadOperation(
    expectedPhase: Exclude<ThreadOperationPhase, "idle">,
  ): void {
    setThreadOperationPhase(
      (current) =>
        transitionThreadOperation(current, {
          type: "complete",
          phase: expectedPhase,
        }).to,
    );
  }

  // Thread request-state helpers.
  function readThreadRequestState(threadId: string): ThreadRequestState {
    return readThreadRequestStateById(
      {
        threadRequestStateById: threadRequestStateByIdRef.current,
      },
      threadId,
    );
  }

  function updateThreadRequestState(
    threadId: string,
    updater: (current: ThreadRequestState) => ThreadRequestState,
  ): void {
    if (!threadId) {
      return;
    }

    dispatchWorkspaceInteraction({
      type: "thread_request_state/set",
      threadId,
      nextState: updater(readThreadRequestState(threadId)),
    });
  }

  function assignThreadSendAbortController(
    threadId: string,
    abortController: AbortController,
  ): void {
    const normalizedThreadId = threadId.trim();
    if (!normalizedThreadId) {
      return;
    }

    threadSendAbortControllerByIdRef.current.set(
      normalizedThreadId,
      abortController,
    );
  }

  function clearThreadSendAbortController(
    threadId: string,
    abortController?: AbortController,
  ): void {
    const normalizedThreadId = threadId.trim();
    if (!normalizedThreadId) {
      return;
    }

    if (abortController) {
      const current =
        threadSendAbortControllerByIdRef.current.get(normalizedThreadId);
      if (current !== abortController) {
        return;
      }
    }

    threadSendAbortControllerByIdRef.current.delete(normalizedThreadId);
  }

  function cancelThreadInProgressProcessing(threadIdRaw: string): boolean {
    const threadId = threadIdRaw.trim();
    if (!threadId) {
      return false;
    }

    const currentState = readThreadRequestState(threadId);
    if (!currentState.isSending) {
      return false;
    }

    const abortController =
      threadSendAbortControllerByIdRef.current.get(threadId);
    if (abortController) {
      abortController.abort();
      threadSendAbortControllerByIdRef.current.delete(threadId);
    }

    updateThreadRequestState(threadId, (current) => ({
      ...current,
      isSending: false,
      sendProgressMessages: [],
      activeTurnId: null,
      lastErrorTurnId: null,
      error: null,
    }));
    return true;
  }

  function appendThreadProgressMessage(
    threadId: string,
    message: string,
  ): void {
    const trimmed = message.trim();
    if (!threadId || !trimmed) {
      return;
    }

    updateThreadRequestState(threadId, (current) => {
      if (
        current.sendProgressMessages[
          current.sendProgressMessages.length - 1
        ] === trimmed
      ) {
        return current;
      }

      const nextMessages = [...current.sendProgressMessages, trimmed].slice(-8);
      return {
        ...current,
        sendProgressMessages: nextMessages,
      };
    });
  }

  // Thread snapshot mutation helpers.
  function isArchivedThread(threadIdRaw: string): boolean {
    return isThreadArchivedById(threadsRef.current, threadIdRaw);
  }

  function resolveThreadNameForSave(
    baseName: string,
    includeDraftName: boolean,
  ): string {
    if (!includeDraftName) {
      return baseName;
    }

    const draftName = activeThreadNameInput.trim();
    if (!draftName) {
      return baseName;
    }

    return draftName.slice(0, THREAD_NAME_MAX_LENGTH);
  }

  function shouldPersistThreadState(
    thread: Pick<
      ThreadState,
      | "id"
      | "messages"
      | "reasoningEffort"
      | "webSearchEnabled"
      | "instructionContextToggles"
      | "threadEnvironment"
    > &
      Partial<Pick<ThreadState, "skillSelections">>,
  ): boolean {
    if (hasThreadPersistableState(thread)) {
      return true;
    }

    return threadSaveSignatureByIdRef.current.has(thread.id);
  }

  function createLocalThreadState(
    options: {
      name?: string;
    } = {},
  ): ThreadState {
    const now = new Date().toISOString();
    const normalizedName = (options.name ?? "")
      .trim()
      .slice(0, THREAD_NAME_MAX_LENGTH);
    const name = normalizedName || THREAD_DEFAULT_NAME;
    const defaultThreadMcpServers =
      workspaceMcpServerProfilesRef.current.filter(
        (server) => server.connectOnThreadCreate === true,
      );

    return {
      id: createId("thread"),
      name,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      reasoningEffort: DEFAULT_REASONING_EFFORT,
      webSearchEnabled: DEFAULT_WEB_SEARCH_ENABLED,
      agentInstruction: DEFAULT_AGENT_INSTRUCTION,
      instructionContextToggles: cloneThreadInstructionContexts(
        DEFAULT_THREAD_INSTRUCTION_CONTEXT_TOGGLES,
      ),
      threadEnvironment: {},
      messages: [],
      mcpServers: cloneMcpServers(defaultThreadMcpServers),
      mcpRpcLogs: [],
      skillSelections: [],
    };
  }

  function buildThreadStateFromCurrentState(
    base: ThreadState,
    options: {
      includeDraftName?: boolean;
    } = {},
  ): ThreadState {
    const includeDraftName = options.includeDraftName === true;
    return {
      ...base,
      name: resolveThreadNameForSave(base.name, includeDraftName),
      updatedAt: new Date().toISOString(),
      reasoningEffort,
      webSearchEnabled,
      agentInstruction,
      instructionContextToggles: cloneThreadInstructionContexts(
        instructionContextToggles,
      ),
      threadEnvironment: cloneThreadEnvironment(base.threadEnvironment),
      messages: cloneMessages(messages),
      mcpServers: cloneMcpServers(mcpServers),
      mcpRpcLogs: cloneThreadOperationLogs(mcpRpcLogs),
      skillSelections: cloneThreadSkillActivations(selectedThreadSkills),
    };
  }

  function setThreadSaveSignatures(nextThreads: ThreadState[]) {
    const signatureMap = threadSaveSignatureByIdRef.current;
    signatureMap.clear();
    for (const thread of nextThreads) {
      signatureMap.set(thread.id, buildThreadSaveSignature(thread));
    }
  }

  function buildThreadPersistenceOperationDeps() {
    return {
      readActiveWorkspaceUserKey: () => activeWorkspaceUserKeyRef.current,
      readActiveThreadId: () => activeThreadIdRef.current,
      readThreads: () => threadsRef.current,
      hasSavedThreadSignature: (threadId: string) =>
        threadSaveSignatureByIdRef.current.has(threadId),
      readSavedThreadSignature: (threadId: string) =>
        threadSaveSignatureByIdRef.current.get(threadId),
      writeThreadSaveSignature: (threadId: string, signature: string) => {
        threadSaveSignatureByIdRef.current.set(threadId, signature);
      },
      nextThreadSaveRequestSeq: () => {
        threadSaveRequestSeqRef.current += 1;
        return threadSaveRequestSeqRef.current;
      },
      readThreadSaveRequestSeq: () => threadSaveRequestSeqRef.current,
      setIsSavingThread,
      markAzureAuthRequired,
      setThreadError,
      updateThreadsState,
      setActiveThreadNameInput,
      shouldPersistThreadState,
      buildThreadStateFromCurrentState,
      clearThreadNameSaveTimeout,
      clearThreadSaveTimeout,
      saveThread: (payload: ThreadWritePayload, options: {
        isUpdate?: boolean;
        onAuthRequired?: () => void;
      }) => threadsApiClient.saveThread(payload, options),
      logClientInfo,
      logClientError,
    };
  }

  function buildThreadTitleOperationDeps() {
    return {
      isArchivedThread,
      isChatLocked,
      isLoadingUtilityAzureDeployments,
      readActiveUtilityAzureConnection: () => activeUtilityAzureConnection,
      readSelectedUtilityAzureDeploymentName: () =>
        selectedUtilityAzureDeploymentName,
      isSelectedUtilityDeploymentAvailable: (deploymentName: string) =>
        includesAzureDeploymentName(utilityAzureDeployments, deploymentName),
      readThreadById: (threadId: string) =>
        findThreadStateById(threadsRef.current, threadId) ?? undefined,
      readActiveThreadId: () => activeThreadIdRef.current,
      readActiveThreadNameInput: () => activeThreadNameInputRef.current,
      readAgentInstruction: () => agentInstruction,
      readActiveAzureTenantId: () => activeAzureTenantIdRef.current,
      isUtilityReasoningEffortSupported,
      readEffectiveUtilityReasoningEffort: () =>
        effectiveUtilityReasoningEffort,
      generateTitle: (request: {
        playgroundContent: string;
        instruction: string;
        azureConfig: {
          tenantId: string;
          projectName: string;
          baseUrl: string;
          apiVersion: string;
          deploymentName: string;
        };
        supportsReasoningEffort: boolean;
        reasoningEffort?: ThreadState["reasoningEffort"];
      }) => threadTitleApiClient.generateTitle(request),
      updateThreadStateById,
      setActiveThreadNameInput,
      saveActiveThreadNameInBackground,
      isSwitchingAzureTenant,
      reportAzureTenantSwitchPending,
      logClientError,
    };
  }

  function buildThreadLoadingOperationDeps() {
    return {
      readActiveWorkspaceUserKey: () => activeWorkspaceUserKeyRef.current,
      clearThreadsState,
      nextThreadLoadRequestSeq: () => {
        threadLoadRequestSeqRef.current += 1;
        return threadLoadRequestSeqRef.current;
      },
      readThreadLoadRequestSeq: () => threadLoadRequestSeqRef.current,
      beginThreadOperation: () => beginThreadOperation("loading"),
      endThreadOperation: () => endThreadOperation("loading"),
      setThreadError,
      loadThreads: (options: { onAuthRequired?: () => void }) =>
        threadsApiClient.loadThreads(options),
      markAzureAuthRequired,
      setThreadSaveSignatures,
      setThreadsState,
      pruneThreadRequestState: (validThreadIds: string[]) => {
        dispatchWorkspaceInteraction({
          type: "thread_request_state/prune",
          validThreadIds,
        });
      },
      setThreadsReady: () => {
        isThreadsReadyRef.current = true;
      },
      readPreferredThreadId: () => activeThreadIdRef.current,
      applyThreadState,
      createLocalThreadState: () => createLocalThreadState(),
      logClientInfo,
      logClientError,
    };
  }

  function buildSendMessageOperationDeps() {
    return {
      readActiveThreadId: () => activeThreadIdRef.current,
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
      isSelectedPlaygroundDeploymentAvailable: (deploymentName: string) =>
        includesAzureDeploymentName(playgroundAzureDeployments, deploymentName),
      isPlaygroundReasoningEffortSupported,
      isSelectedPlaygroundReasoningEffortOptionAvailable: (
        nextReasoningEffort: ReasoningEffort,
      ) =>
        effectivePlaygroundReasoningEffortOptions.includes(nextReasoningEffort),
      readReasoningEffort: () => reasoningEffort,
      readWebSearchEnabled: () => webSearchEnabled,
      readBaseThread: (threadId: string) =>
        findThreadStateById(threadsRef.current, threadId),
      readDraftAttachments: () => draftAttachments,
      readMessages: () => messages,
      readMcpServers: () => mcpServers,
      readSelectedMessageSkillActivations: () =>
        selectedMessageSkillActivations,
      readSelectedThreadSkills: () => selectedThreadSkills,
      readAgentInstruction: () => agentInstruction,
      readInstructionContextToggles: () => instructionContextToggles,
      readActiveAzureTenantId: () => activeAzureTenantIdRef.current,
      createTurnId: () => createId("turn"),
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
      sendMessageTransport: (options: Parameters<
        typeof executeSendMessageTransport
      >[1]) =>
        executeSendMessageTransport(
          {
            sendMessage: (payload, sendOptions) =>
              chatApiClient.sendMessage(payload, sendOptions),
            markAzureAuthRequired,
          },
          options,
        ),
      appendThreadProgressMessage,
      appendThreadOperationLogToThreadState,
      applyThreadEnvironmentToThreadState,
      clearThreadSendAbortController,
      scheduleThreadStateSave: (threadId: string) => {
        window.setTimeout(() => {
          void saveThreadStateSilentlyIfNeeded(threadId);
        }, 0);
      },
    };
  }

  function updateThreadStateById(
    threadId: string,
    updater: (current: ThreadState) => ThreadState,
  ): void {
    if (!threadId) {
      return;
    }

    updateThreadsState((current) =>
      updateThreadStateCollectionById(current, threadId, updater),
    );
  }

  function appendMessageToThreadState(
    threadId: string,
    message: ThreadMessage,
  ): void {
    const clonedMessage: ThreadMessage = {
      ...message,
      attachments: message.attachments.map((attachment) => ({ ...attachment })),
      skillActivations: message.skillActivations.map((selection) => ({
        ...selection,
      })),
    };

    updateThreadStateById(threadId, (thread) => ({
      ...thread,
      updatedAt: new Date().toISOString(),
      messages: [...thread.messages, clonedMessage],
    }));
  }

  function appendThreadOperationLogToThreadState(
    threadId: string,
    entry: ThreadOperationLogEntry,
  ): void {
    const clonedEntry: ThreadOperationLogEntry = { ...entry };

    updateThreadStateById(threadId, (thread) => ({
      ...thread,
      updatedAt: new Date().toISOString(),
      mcpRpcLogs: upsertThreadOperationLogEntry(thread.mcpRpcLogs, clonedEntry),
    }));
  }

  function applyThreadEnvironmentToThreadState(
    threadId: string,
    environmentValue: unknown,
  ): void {
    if (!threadId) {
      return;
    }

    const nextEnvironment = readThreadEnvironmentFromUnknown(environmentValue);
    updateThreadStateById(threadId, (thread) => ({
      ...thread,
      updatedAt: new Date().toISOString(),
      threadEnvironment: cloneThreadEnvironment(nextEnvironment),
    }));
  }

  function applyThreadState(thread: ThreadState) {
    isApplyingThreadStateRef.current = true;

    activeThreadIdRef.current = thread.id;
    setActiveThreadId(thread.id);
    setActiveThreadNameInput(thread.name);
    setSelectedMessageSkillActivations([]);
    setReasoningEffort(thread.reasoningEffort);
    setWebSearchEnabled(thread.webSearchEnabled);
    setAgentInstruction(thread.agentInstruction);
    setInstructionContextToggles(
      cloneThreadInstructionContexts(thread.instructionContextToggles),
    );
    setLoadedInstructionFileName(null);
    setInstructionFileError(null);
    setInstructionSaveError(null);
    setInstructionSaveSuccess(null);
    setInstructionEnhanceError(null);
    setInstructionEnhanceSuccess(null);
    setInstructionEnhanceComparison(null);
    setDraft("");
    setDraftAttachments([]);
    setChatAttachmentError(null);
    setUiError(null);
    setSystemNotice(null);
    setIsComposing(false);

    window.setTimeout(() => {
      isApplyingThreadStateRef.current = false;
    }, 0);
  }

  function showThreadReloadPlaceholder(): void {
    const localThread = createLocalThreadState();
    isThreadsReadyRef.current = true;
    setThreadsState([localThread]);
    dispatchWorkspaceInteraction({
      type: "thread_request_state/reset_all",
    });
    applyThreadState(localThread);
    setThreadError(null);
    beginThreadOperation("loading");
  }

  // Thread persistence and title-refresh orchestration.
  async function saveThreadStateToDatabase(
    thread: ThreadState,
    signature: string,
    options: {
      showBusy?: boolean;
      reportError?: boolean;
    } = {},
  ): Promise<boolean> {
    return await saveThreadStateToDatabaseOperation(
      buildThreadPersistenceOperationDeps(),
      thread,
      signature,
      options,
    );
  }

  async function saveThreadStateSilentlyIfNeeded(
    threadId: string,
  ): Promise<void> {
    await saveThreadStateSilentlyIfNeededOperation(
      buildThreadPersistenceOperationDeps(),
      threadId,
    );
  }

  async function flushActiveThreadState(): Promise<boolean> {
    return await flushActiveThreadStateOperation(
      buildThreadPersistenceOperationDeps(),
    );
  }

  async function saveActiveThreadNameInBackground(
    threadId: string,
    name: string,
  ): Promise<void> {
    await saveActiveThreadNameInBackgroundOperation(
      buildThreadPersistenceOperationDeps(),
      threadId,
      name,
    );
  }

  async function refreshThreadTitleInBackground(options: {
    threadId: string;
    reason:
      | "first_message"
      | "instruction_update"
      | "utility_deployment_update";
    instructionOverride?: string;
  }): Promise<void> {
    await refreshThreadTitleInBackgroundOperation(
      buildThreadTitleOperationDeps(),
      options,
    );
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
    isSelectedUtilityDeploymentAvailable: (deploymentName: string) =>
      includesAzureDeploymentName(utilityAzureDeployments, deploymentName),
    buildThreadStateFromCurrentState,
    shouldPersistThreadState: (thread) => shouldPersistThreadState(thread),
    saveThreadStateToDatabase,
    saveActiveThreadNameInBackground,
    refreshThreadTitleInBackground,
  });

  // Thread lifecycle actions (load/create/rename/archive/switch).
  async function loadThreads(): Promise<void> {
    await loadThreadsOperation(buildThreadLoadingOperationDeps());
  }

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
    buildThreadStateFromCurrentState,
    saveThreadStateToDatabase,
    flushActiveThreadState,
    cancelThreadInProgressProcessing,
    createLocalThreadState,
    loadThreads,
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
    await sendMessageOperation(buildSendMessageOperationDeps());
  }

  function handleReloadSkills() {
    handleReloadSkillsOperation(buildSkillCatalogOperationDeps());
  }

  const {
    handleToggleRegistrySkill,
    handleAddMessageSkillActivation,
    handleRemoveMessageSkillActivation,
    handleAddThreadSkill,
    handleRemoveThreadSkill,
    handleToggleThreadSkill,
  } = createSkillSelectionHandlers({
    availableSkillByLocation,
    skillRegistryCatalogs,
    readActiveThreadId: () => activeThreadIdRef.current,
    updateThreadStateById,
    setSelectedMessageSkillActivations,
    setSkillsError,
    updateSkillRegistrySkill,
  });

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
    loadWorkspaceMcpServerProfiles: async () =>
      await loadWorkspaceMcpServerProfilesOperation(
        buildWorkspaceMcpServerProfileOperationDeps(),
      ),
    clearMcpServerEditState,
    setEditingMcpServerId,
    populateMcpServerFormForEdit,
    setMcpFormError,
    setMcpFormWarning,
    setIsDeletingWorkspaceMcpServerProfile,
    setIsSavingMcpServer,
    applyWorkspaceMcpServerProfiles: (profiles) => {
      applyWorkspaceMcpServerProfilesOperation(
        buildWorkspaceMcpServerProfileOperationDeps(),
        profiles,
      );
    },
    deleteWorkspaceMcpServerProfileFromConfig: async (serverId) =>
      await deleteWorkspaceMcpServerProfileFromConfigOperation(
        buildWorkspaceMcpServerProfileOperationDeps(),
        serverId,
      ),
    saveMcpServerToConfig: async (server, options) =>
      await saveMcpServerToConfigOperation(
        buildWorkspaceMcpServerProfileOperationDeps(),
        server,
        options,
      ),
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
    handleClearInstruction,
    handleInstructionFileChange,
  } = createInstructionEditingHandlers({
    isArchivedThread,
    readActiveThreadId: () => activeThreadIdRef.current,
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

  const configPanelProps = buildWorkspaceConfigPanelProps({
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
