/**
 * Workspace client usecase module.
 */
import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type {
  ThemeMode,
  MainViewTab,
  McpTransport,
  ReasoningEffort,
} from "~/lib/client/usecase/workspace/view-types";
import {
  CHAT_ATTACHMENT_ALLOWED_EXTENSIONS,
  CHAT_ATTACHMENT_MAX_FILES,
  DEFAULT_AGENT_INSTRUCTION,
  DEFAULT_REASONING_EFFORT,
  DEFAULT_WEB_SEARCH_ENABLED,
  THREAD_DEFAULT_NAME,
} from "~/lib/constants/chat";
import {
  DEFAULT_THEME_MODE,
  INITIAL_THREAD_MESSAGES,
  CLIENT_MAIN_SPLITTER_MIN_RIGHT_WIDTH_PX,
  THREAD_NAME_MAX_LENGTH,
} from "~/lib/constants/client";
import {
  INSTRUCTION_ALLOWED_EXTENSIONS,
  INSTRUCTION_ENHANCE_SYSTEM_PROMPT,
  INSTRUCTION_MAX_FILE_SIZE_BYTES,
  INSTRUCTION_MAX_FILE_SIZE_LABEL,
} from "~/lib/constants/instruction";
import {
  DEFAULT_MCP_TRANSPORT,
  MCP_DEFAULT_AZURE_AUTH_SCOPE,
  MCP_DEFAULT_TIMEOUT_SECONDS,
  MCP_TIMEOUT_SECONDS_MAX,
  MCP_TIMEOUT_SECONDS_MIN,
} from "~/lib/constants/mcp";
import { CLIENT_SKILLS_RELOAD_MIN_INTERVAL_MS } from "~/lib/constants/skills";
import { isLikelyChatAzureAuthError } from "~/lib/client/usecase/workspace/azure-errors";
import { buildThreadOperationLogsByTurnId } from "~/lib/client/chat/history";
import type { DraftChatAttachment } from "~/lib/client/chat/attachments";
import {
  readChatCommandMatchAtCursor,
} from "~/lib/client/chat/commands";
import type { ThreadMessage } from "~/lib/client/chat/messages";
import { createThreadMessage } from "~/lib/client/chat/messages";
import type {
  ChatApiResponse,
  ThreadOperationLogEntry,
} from "~/lib/client/chat/stream";
import {
  readChatEventStreamPayload,
  upsertThreadOperationLogEntry,
} from "~/lib/client/chat/stream";
import {
  applyInstructionUnifiedDiffPatch,
  buildInstructionEnhanceMessage,
  buildInstructionSuggestedFileName,
  describeInstructionLanguage,
  detectInstructionLanguage,
  isInstructionSaveCanceled,
  normalizeInstructionDiffPatchResponse,
  resolveInstructionFormatExtension,
  resolveInstructionSourceFileName,
  saveInstructionToClientFile,
  validateEnhancedInstructionFormat,
} from "~/lib/client/usecase/workspace/instruction-document";
import { resolveMainSplitterMaxRightWidth } from "~/lib/client/usecase/workspace/main-splitter";
import type { McpServerConfig } from "~/lib/contracts/mcp/profile";
import { buildMcpServerKey, upsertMcpServer } from "~/lib/contracts/mcp/profile";
import {
  buildWorkspaceMcpServerProfileOptions,
  countSelectedWorkspaceMcpServerProfileOptions,
} from "~/lib/client/usecase/workspace/workspace-mcp-server-profiles";
import {
  installGlobalClientErrorLogging,
  reportClientEvent,
  reportClientError,
  reportClientWarning,
} from "~/lib/client/infrastructure/browser/runtime-event-log-client";
import {
  buildThreadSummary,
  convertThreadResourceToState,
  convertThreadStateToWritePayload,
  readThreadResourceFromUnknown,
  readThreadStateListFromResources,
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
  upsertThreadState,
} from "~/lib/contracts/threads/state";
import { readThreadEnvironmentFromUnknown } from "~/lib/contracts/threads/environment";
import {
  DEFAULT_THREAD_INSTRUCTION_CONTEXT_TOGGLES,
  THREAD_INSTRUCTION_CONTEXT_OPTIONS,
  type ThreadInstructionContextToggleKey,
} from "~/lib/contracts/threads/instruction-context";
import {
  buildThreadAutoTitlePlaygroundContent,
  normalizeThreadAutoTitle,
} from "~/lib/contracts/threads/title";
import type {
  ThreadState,
  ThreadSummary,
} from "~/lib/contracts/threads/types";
import {
  readSkillCatalogList,
  readSkillRegistryCatalogList,
} from "~/lib/contracts/skills/parsers";
import {
  type SkillRegistryId,
} from "~/lib/contracts/skills/registry";
import type {
  SkillCatalogEntry,
  SkillRegistryCatalog,
  ThreadSkillActivation,
} from "~/lib/contracts/skills/types";
import { copyTextToClipboard } from "~/lib/client/infrastructure/browser/clipboard";
import { readStringList } from "~/lib/client/usecase/workspace/collections";
import { getFileExtension } from "~/lib/client/usecase/workspace/files";
import { createId } from "~/lib/client/usecase/workspace/ids";
import { clampNumber } from "~/lib/client/usecase/workspace/numbers";
import {
  getDefaultDesktopUpdaterStatus,
  readDesktopApi,
  readDesktopUpdaterStatusFromUnknown,
  resolveDesktopUpdaterActionState,
} from "~/lib/client/usecase/workspace/desktop-updater";
import { serializeMcpServersForChatRequest } from "~/lib/client/usecase/workspace/mcp-runtime";
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
  mergeSkillSelections,
} from "~/lib/client/usecase/workspace/thread-runtime";
import {
  readThreadRequestStateById,
  workspaceInteractionReducer,
} from "~/lib/client/usecase/workspace/reducer";
import {
  createInitialWorkspaceInteractionState,
} from "~/lib/client/usecase/workspace/state";
import {
  applySendResult,
  buildChatRequestPayload,
  consumeChatResponseStream,
  validateSendPreconditions,
} from "~/lib/client/usecase/workspace/send-message-usecase";
import {
  ClientApiError,
  mapApiError,
  requestClientApi,
  resolveAuthRequired,
} from "~/lib/client/infrastructure/api/api-client";
import { mcpServersApiClient } from "~/lib/client/infrastructure/api/mcp-servers-api-client";
import { skillsApiClient } from "~/lib/client/infrastructure/api/skills-api-client";
import { readJsonPayload } from "~/lib/client/infrastructure/api/http";
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
  buildMcpServersTabProps,
  buildPlaygroundPanelProps,
  buildSettingsTabProps,
  buildMessageSkillActivationOptions,
  buildSkillRegistryGroups,
  buildSkillsTabProps,
  buildThreadSkillOptions,
  buildThreadsTabProps,
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
  createMcpProfileHandlers,
} from "~/lib/client/usecase/workspace/mcp-profile-handlers";
import {
  createSkillSelectionHandlers,
} from "~/lib/client/usecase/workspace/skill-selection-handlers";
import {
  type InstructionEnhanceComparison,
  type SkillsApiResponse,
  type ThreadRequestState,
  type ThreadTitleApiResponse,
  type ThreadsApiResponse,
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
  const [desktopUpdaterStatus, setDesktopUpdaterStatus] = useState(
    getDefaultDesktopUpdaterStatus,
  );
  const [isApplyingDesktopUpdate, setIsApplyingDesktopUpdate] = useState(false);
  const [rightPaneWidth, setRightPaneWidth] = useState(420);
  const [activeResizeHandle, setActiveResizeHandle] = useState<"main" | null>(
    null,
  );
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
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const activeAzureTenantIdRef = useRef("");
  const activeAzurePrincipalIdRef = useRef("");
  const activeWorkspaceUserKeyRef = useRef("");
  const workspaceMcpServerProfileRequestSeqRef = useRef(0);
  const skillsRequestSeqRef = useRef(0);
  const lastManualSkillsReloadAtRef = useRef(0);
  const lastLoadedSkillsUserKeyRef = useRef("");
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
    clearWorkspaceMcpServerProfilesState,
    loadWorkspaceMcpServerProfiles,
    clearThreadsState,
    showThreadReloadPlaceholder,
    loadThreads,
    logClientError,
    logClientWarning,
  });
  const previousIsAzureAuthRequiredRef = useRef(isAzureAuthRequired);
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

  // Observability helpers for Client runtime events.
  function buildRuntimeLogContext(
    extra: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      activeMainTab: activeMainTabRef.current,
      activeThreadId: activeThreadIdRef.current,
      selectedPlaygroundAzureConnectionId:
        selectedPlaygroundAzureConnectionIdRef.current,
      selectedPlaygroundAzureDeploymentName:
        selectedPlaygroundAzureDeploymentNameRef.current,
      selectedUtilityAzureConnectionId:
        selectedUtilityAzureConnectionIdRef.current,
      selectedUtilityAzureDeploymentName:
        selectedUtilityAzureDeploymentNameRef.current,
      tenantId: activeAzureTenantIdRef.current,
      principalId: activeAzurePrincipalIdRef.current,
      ...extra,
    };
  }

  function logClientError(
    eventName: string,
    error: unknown,
    options: {
      category?: string;
      location?: string;
      action?: string;
      statusCode?: number;
      context?: Record<string, unknown>;
    } = {},
  ): void {
    reportClientError(eventName, error, {
      category: options.category ?? "frontend",
      location: options.location ?? "client.controller",
      action: options.action,
      ...(options.statusCode !== undefined
        ? { statusCode: options.statusCode }
        : {}),
      threadId: activeThreadIdRef.current || undefined,
      context: buildRuntimeLogContext(options.context),
    });
  }

  function logClientWarning(
    eventName: string,
    message: string,
    options: {
      category?: string;
      location?: string;
      action?: string;
      context?: Record<string, unknown>;
    } = {},
  ): void {
    reportClientWarning(eventName, message, {
      category: options.category ?? "frontend",
      location: options.location ?? "client.controller",
      action: options.action,
      threadId: activeThreadIdRef.current || undefined,
      context: buildRuntimeLogContext(options.context),
    });
  }

  function logClientInfo(
    eventName: string,
    message: string,
    options: {
      category?: string;
      location?: string;
      action?: string;
      context?: Record<string, unknown>;
    } = {},
  ): void {
    reportClientEvent({
      level: "info",
      category: options.category ?? "frontend",
      eventName,
      message,
      location: options.location ?? "client.controller",
      ...(options.action ? { action: options.action } : {}),
      ...(activeThreadIdRef.current
        ? { threadId: activeThreadIdRef.current }
        : {}),
      context: buildRuntimeLogContext(options.context),
    });
  }

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
    const desktopApi = readDesktopApi();
    if (!desktopApi) {
      setDesktopUpdaterStatus(getDefaultDesktopUpdaterStatus());
      return;
    }

    let isActive = true;

    const applyStatusPayload = (payload: unknown) => {
      const parsed = readDesktopUpdaterStatusFromUnknown(payload);
      if (!parsed || !isActive) {
        return;
      }

      setDesktopUpdaterStatus(parsed);
    };

    void desktopApi
      .getUpdaterStatus()
      .then((payload) => {
        applyStatusPayload(payload);
      })
      .catch((error) => {
        logClientWarning(
          "desktop_updater_status_read_failed",
          error instanceof Error ? error.message : "Unknown error.",
          {
            location: "controller.desktopUpdater",
          },
        );
      });

    const unsubscribe = desktopApi.onUpdaterStatus((payload) => {
      applyStatusPayload(payload);
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
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
    void loadAvailableSkills();
  }, []);

  useEffect(() => {
    const wasAzureAuthRequired = previousIsAzureAuthRequiredRef.current;
    previousIsAzureAuthRequiredRef.current = isAzureAuthRequired;

    const tenantId = activeAzurePrincipal?.tenantId.trim() ?? "";
    const principalId = activeAzurePrincipal?.principalId.trim() ?? "";
    const activeUserKey =
      !isAzureAuthRequired && tenantId && principalId
        ? `${tenantId}::${principalId}`
        : "";

    if (!activeUserKey) {
      if (isAzureAuthRequired) {
        lastLoadedSkillsUserKeyRef.current = "";
      }
      return;
    }

    const hasAuthRequiredSkillsError =
      skillsError?.includes("Azure login is required.") === true ||
      skillRegistryError?.includes("Azure login is required.") === true;
    const shouldReloadForIdentityChange =
      lastLoadedSkillsUserKeyRef.current !== activeUserKey;
    if (
      !shouldReloadForIdentityChange &&
      !wasAzureAuthRequired &&
      !hasAuthRequiredSkillsError
    ) {
      return;
    }

    lastLoadedSkillsUserKeyRef.current = activeUserKey;
    void loadAvailableSkills();
  }, [
    activeAzurePrincipal?.principalId,
    activeAzurePrincipal?.tenantId,
    isAzureAuthRequired,
    skillRegistryError,
    skillsError,
  ]);

  useEffect(() => {
    if (isChatLocked && activeMainTab !== "settings") {
      setActiveMainTab("settings");
    }
  }, [activeMainTab, isChatLocked]);

  useEffect(() => {
    const body = document.body;
    const previousCursor = body.style.cursor;
    const previousUserSelect = body.style.userSelect;

    if (activeResizeHandle === "main") {
      body.style.cursor = "col-resize";
      body.style.userSelect = "none";
    }

    return () => {
      body.style.cursor = previousCursor;
      body.style.userSelect = previousUserSelect;
    };
  }, [activeResizeHandle]);

  useEffect(() => {
    const handleResize = () => {
      const layoutElement = layoutRef.current;
      if (layoutElement) {
        const rect = layoutElement.getBoundingClientRect();
        const maxRightWidth = resolveMainSplitterMaxRightWidth(rect.width);
        setRightPaneWidth((current) =>
          clampNumber(
            current,
            CLIENT_MAIN_SPLITTER_MIN_RIGHT_WIDTH_PX,
            maxRightWidth,
          ),
        );
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

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

  useEffect(() => {
    return () => {
      clearThreadTitleRefreshTimeout();
      clearThreadNameSaveTimeout();
      clearThreadSaveTimeout();
    };
  }, []);

  useEffect(() => {
    if (!isThreadsReadyRef.current || isApplyingThreadStateRef.current) {
      return;
    }
    if (
      shouldBlockThreadPersistence({
        threadOperationPhase,
        isSending,
        blockOnCreating: false,
      })
    ) {
      return;
    }

    const currentThreadId = activeThreadIdRef.current.trim();
    if (!currentThreadId) {
      return;
    }

    const baseThread = findThreadStateById(
      threadsRef.current,
      currentThreadId,
    );
    if (!baseThread) {
      return;
    }

    const snapshot = buildThreadStateFromCurrentState(baseThread);
    if (!shouldPersistThreadState(snapshot)) {
      return;
    }
    const signature = buildThreadSaveSignature(snapshot);
    const savedSignature = threadSaveSignatureByIdRef.current.get(snapshot.id);
    if (savedSignature === signature) {
      return;
    }

    clearThreadSaveTimeout();
    threadSaveTimeoutRef.current = window.setTimeout(() => {
      threadSaveTimeoutRef.current = null;
      void saveThreadStateToDatabase(snapshot, signature);
    }, 450);

    return () => {
      clearThreadSaveTimeout();
    };
  }, [
    activeThreadId,
    reasoningEffort,
    webSearchEnabled,
    agentInstruction,
    instructionContextToggles,
    messages,
    mcpServers,
    mcpRpcLogs,
    selectedThreadSkills,
    threads,
    isSending,
    threadOperationPhase,
  ]);

  useEffect(() => {
    if (!isThreadsReadyRef.current || isApplyingThreadStateRef.current) {
      return;
    }
    if (
      shouldBlockThreadPersistence({
        threadOperationPhase,
        isSending,
        blockOnCreating: true,
      })
    ) {
      return;
    }

    const currentThreadId = activeThreadIdRef.current.trim();
    if (!currentThreadId) {
      return;
    }

    const baseThread = findThreadStateById(
      threadsRef.current,
      currentThreadId,
    );
    if (!baseThread) {
      return;
    }
    if (!shouldPersistThreadState(baseThread)) {
      return;
    }

    const trimmedName = activeThreadNameInput
      .trim()
      .slice(0, THREAD_NAME_MAX_LENGTH);
    const nextName = trimmedName || baseThread.name;
    if (nextName === baseThread.name) {
      return;
    }

    clearThreadNameSaveTimeout();
    threadNameSaveTimeoutRef.current = window.setTimeout(() => {
      threadNameSaveTimeoutRef.current = null;
      void saveActiveThreadNameInBackground(currentThreadId, nextName);
    }, 3000);

    return () => {
      clearThreadNameSaveTimeout();
    };
  }, [
    activeThreadId,
    activeThreadNameInput,
    threads,
    isSending,
    threadOperationPhase,
  ]);

  useEffect(() => {
    if (!isThreadsReadyRef.current || isApplyingThreadStateRef.current) {
      return;
    }
    if (!canStartThreadOperation(threadOperationPhase)) {
      return;
    }

    const currentThreadId = activeThreadIdRef.current.trim();
    if (!currentThreadId || isArchivedThread(currentThreadId)) {
      return;
    }

    const baseThread = findThreadStateById(
      threadsRef.current,
      currentThreadId,
    );
    if (!baseThread || !hasThreadInteraction(baseThread)) {
      return;
    }

    const currentInstruction = agentInstruction.trim();
    const baseInstruction = baseThread.agentInstruction.trim();
    if (currentInstruction === baseInstruction) {
      return;
    }

    clearThreadTitleRefreshTimeout();
    threadTitleRefreshTimeoutRef.current = window.setTimeout(() => {
      threadTitleRefreshTimeoutRef.current = null;
      void refreshThreadTitleInBackground({
        threadId: currentThreadId,
        reason: "instruction_update",
      });
    }, 1000);

    return () => {
      clearThreadTitleRefreshTimeout();
    };
  }, [activeThreadId, agentInstruction, threads, threadOperationPhase]);

  useEffect(() => {
    if (!isThreadsReadyRef.current || isApplyingThreadStateRef.current) {
      return;
    }
    if (!canStartThreadOperation(threadOperationPhase)) {
      return;
    }
    if (isChatLocked || isLoadingUtilityAzureDeployments) {
      return;
    }

    const deploymentName = selectedUtilityAzureDeploymentName.trim();
    if (
      !deploymentName ||
      !includesAzureDeploymentName(utilityAzureDeployments, deploymentName)
    ) {
      return;
    }

    const currentThreadId = activeThreadIdRef.current.trim();
    if (!currentThreadId || isArchivedThread(currentThreadId)) {
      return;
    }

    const baseThread = findThreadStateById(
      threadsRef.current,
      currentThreadId,
    );
    if (!baseThread || !hasThreadInteraction(baseThread)) {
      return;
    }
    if (baseThread.name.trim() !== THREAD_DEFAULT_NAME) {
      return;
    }

    void refreshThreadTitleInBackground({
      threadId: currentThreadId,
      reason: "utility_deployment_update",
    });
  }, [
    isChatLocked,
    threadOperationPhase,
    isLoadingUtilityAzureDeployments,
    selectedUtilityAzureConnectionId,
    selectedUtilityAzureDeploymentName,
    utilityAzureDeployments,
  ]);

  // Saved MCP / Skills loading flows.
  async function loadWorkspaceMcpServerProfiles() {
    const expectedUserKey = activeWorkspaceUserKeyRef.current.trim();
    if (!expectedUserKey) {
      clearWorkspaceMcpServerProfilesState();
      return;
    }

    const requestSeq = workspaceMcpServerProfileRequestSeqRef.current + 1;
    workspaceMcpServerProfileRequestSeqRef.current = requestSeq;
    setIsLoadingWorkspaceMcpServerProfiles(true);

    try {
      const result = await mcpServersApiClient.loadProfiles({
        onAuthRequired: () => {
          markAzureAuthRequired();
          clearWorkspaceMcpServerProfilesState(
            "Azure login is required. Open Settings and sign in to load MCP servers.",
          );
        },
      });
      if (requestSeq !== workspaceMcpServerProfileRequestSeqRef.current) {
        return;
      }
      if (expectedUserKey !== activeWorkspaceUserKeyRef.current.trim()) {
        return;
      }

      const parsedServers = result.profiles;
      applyWorkspaceMcpServerProfiles(parsedServers);
      setWorkspaceMcpServerProfileError(null);
    } catch (loadError) {
      if (requestSeq !== workspaceMcpServerProfileRequestSeqRef.current) {
        return;
      }
      if (expectedUserKey !== activeWorkspaceUserKeyRef.current.trim()) {
        return;
      }
      if (
        loadError instanceof ClientApiError &&
        loadError.kind === "auth_required"
      ) {
        return;
      }
      logClientError("load_saved_mcp_servers_failed", loadError, {
        action: "load_saved_mcp_servers",
        statusCode: 500,
      });
      setWorkspaceMcpServerProfileError(
        mapApiError(loadError, "Failed to load saved MCP servers."),
      );
    } finally {
      if (
        requestSeq === workspaceMcpServerProfileRequestSeqRef.current &&
        expectedUserKey === activeWorkspaceUserKeyRef.current.trim()
      ) {
        setIsLoadingWorkspaceMcpServerProfiles(false);
      }
    }
  }

  async function loadAvailableSkills(
    options: {
      clearStatus?: boolean;
      forceRefresh?: boolean;
    } = {},
  ): Promise<void> {
    const expectedUserKey = activeWorkspaceUserKeyRef.current.trim();
    const requestSeq = skillsRequestSeqRef.current + 1;
    skillsRequestSeqRef.current = requestSeq;

    if (options.clearStatus !== false) {
      setSkillsError(null);
      setSkillsWarning(null);
      setSkillRegistryError(null);
      setSkillRegistryWarning(null);
      setSkillRegistrySuccess(null);
    }
    setIsLoadingSkills(true);

    try {
      const result = await skillsApiClient.loadSkills({
        forceRefresh: options.forceRefresh,
        onAuthRequired: () => {
          markAzureAuthRequired();
          setAvailableSkills([]);
          setSkillRegistryCatalogs([]);
          setSkillsError(
            "Azure login is required. Open Settings and sign in to load Skills.",
          );
          setSkillRegistryError(
            "Azure login is required. Open Settings and sign in to load Skills.",
          );
        },
      });
      if (requestSeq !== skillsRequestSeqRef.current) {
        return;
      }
      if (expectedUserKey !== activeWorkspaceUserKeyRef.current.trim()) {
        return;
      }

      resolveAzureBackgroundSuccess();
      applySkillsApiPayload(result.payload);
      setSkillRegistrySuccess(null);
    } catch (loadError) {
      if (requestSeq !== skillsRequestSeqRef.current) {
        return;
      }
      if (expectedUserKey !== activeWorkspaceUserKeyRef.current.trim()) {
        return;
      }
      if (
        loadError instanceof ClientApiError &&
        loadError.kind === "auth_required"
      ) {
        return;
      }

      logClientError("load_skills_failed", loadError, {
        action: "load_skills",
      });
      setAvailableSkills([]);
      setSkillRegistryCatalogs([]);
      setSkillsError(mapApiError(loadError, "Failed to load Skills."));
      setSkillRegistryError(
        mapApiError(loadError, "Failed to load Skill registries."),
      );
    } finally {
      if (requestSeq === skillsRequestSeqRef.current) {
        setIsLoadingSkills(false);
      }
    }
  }

  function applySkillsApiPayload(payload: SkillsApiResponse) {
    const parsedSkills = readSkillCatalogList(payload.skills);
    const parsedRegistryCatalogs = readSkillRegistryCatalogList(
      payload.registries,
    );
    const skillWarnings = readStringList(payload.skillWarnings);
    const registryWarnings = readStringList(payload.registryWarnings);

    setAvailableSkills(parsedSkills);
    setSkillRegistryCatalogs(parsedRegistryCatalogs);
    setSkillsError(null);
    setSkillRegistryError(null);
    setSkillsWarning(
      skillWarnings.length > 0 ? skillWarnings.slice(0, 2).join("\n") : null,
    );
    setSkillRegistryWarning(
      registryWarnings.length > 0
        ? registryWarnings.slice(0, 2).join("\n")
        : null,
    );
  }

  async function updateSkillRegistrySkill(options: {
    action: "install_registry_skill" | "delete_registry_skill";
    registryId: SkillRegistryId;
    skillName: string;
  }): Promise<void> {
    setIsMutatingSkillRegistries(true);
    setSkillRegistryError(null);
    setSkillRegistrySuccess(null);

    try {
      const result = await skillsApiClient.updateRegistrySkill({
        action: options.action,
        registryId: options.registryId,
        skillName: options.skillName,
        onAuthRequired: () => {
          markAzureAuthRequired();
        },
      });

      resolveAzureBackgroundSuccess();
      applySkillsApiPayload(result.payload);
      setSkillRegistrySuccess(result.message);
    } catch (error) {
      if (error instanceof ClientApiError && error.kind === "auth_required") {
        setSkillRegistryError(error.message);
        return;
      }
      logClientError("update_skill_registry_failed", error, {
        action: options.action,
        context: {
          registryId: options.registryId,
          skillName: options.skillName,
        },
      });
      setSkillRegistryError(
        mapApiError(error, "Failed to update Skill registry."),
      );
    } finally {
      setIsMutatingSkillRegistries(false);
    }
  }

  function clearWorkspaceMcpServerProfilesState(
    nextError: string | null = null,
  ) {
    setEditingMcpServerId("");
    setIsDeletingWorkspaceMcpServerProfile(false);
    applyWorkspaceMcpServerProfiles([]);
    setWorkspaceMcpServerProfileError(nextError);
    setIsLoadingWorkspaceMcpServerProfiles(false);
  }

  function applyWorkspaceMcpServerProfiles(profiles: McpServerConfig[]) {
    workspaceMcpServerProfilesRef.current = profiles;
    setWorkspaceMcpServerProfiles(profiles);
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
    const showBusy = options.showBusy !== false;
    const reportError = options.reportError !== false;
    if (!shouldPersistThreadState(thread)) {
      return true;
    }
    const expectedUserKey = activeWorkspaceUserKeyRef.current.trim();
    if (!expectedUserKey) {
      return false;
    }

    const expectedThreadId = thread.id;
    const hasPersistedSignature =
      threadSaveSignatureByIdRef.current.has(expectedThreadId);
    const endpoint = hasPersistedSignature
      ? `/api/threads/${encodeURIComponent(expectedThreadId)}`
      : "/api/threads";
    const method = hasPersistedSignature ? "PUT" : "POST";
    const requestSeq = threadSaveRequestSeqRef.current + 1;
    threadSaveRequestSeqRef.current = requestSeq;
    if (showBusy) {
      setIsSavingThread(true);
    }

    try {
      const { payload } = await requestClientApi<ThreadsApiResponse>({
        url: endpoint,
        init: {
          method,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(convertThreadStateToWritePayload(thread)),
        },
        readPayload: (response) =>
          readJsonPayload<ThreadsApiResponse>(response, "Threads"),
        resolveAuthRequired: (status, responsePayload) =>
          resolveAuthRequired(status, responsePayload),
        readErrorMessage: (responsePayload) =>
          typeof responsePayload.error === "string"
            ? responsePayload.error
            : null,
        fallbackErrorMessage: "Failed to save thread.",
        authRequiredMessage:
          "Azure login is required. Open Settings and sign in to continue.",
        onAuthRequired: () => {
          markAzureAuthRequired();
          if (reportError) {
            setThreadError(
              "Azure login is required. Open Settings and sign in to continue.",
            );
          }
        },
      });

      const savedThreadResource = readThreadResourceFromUnknown(payload.thread);
      if (!savedThreadResource) {
        throw new Error("Saved thread payload is invalid.");
      }
      const savedThread = convertThreadResourceToState(savedThreadResource, {
        fallbackInstruction: DEFAULT_AGENT_INSTRUCTION,
      });
      if (expectedUserKey !== activeWorkspaceUserKeyRef.current.trim()) {
        return false;
      }

      if (expectedThreadId !== savedThread.id) {
        return false;
      }

      updateThreadsState((current) =>
        upsertThreadState(current, savedThread),
      );
      threadSaveSignatureByIdRef.current.set(savedThread.id, signature);
      if (savedThread.id === activeThreadIdRef.current) {
        setActiveThreadNameInput(savedThread.name);
      }
      logClientInfo(
        "save_thread_snapshot_succeeded",
        "Thread snapshot saved.",
        {
          action: "save_thread_snapshot",
          context: {
            method,
            threadId: savedThread.id,
            messageCount: savedThread.messages.length,
            mcpServerCount: savedThread.mcpServers.length,
            operationLogCount: savedThread.mcpRpcLogs.length,
            skillSelectionCount: savedThread.skillSelections.length,
          },
        },
      );
      return true;
    } catch (saveError) {
      if (
        saveError instanceof ClientApiError &&
        saveError.kind === "auth_required"
      ) {
        return false;
      }
      logClientError("save_thread_snapshot_failed", saveError, {
        action: "save_thread_snapshot",
        statusCode: 500,
        context: {
          threadId: expectedThreadId,
        },
      });
      if (reportError) {
        setThreadError(mapApiError(saveError, "Failed to save thread."));
      }
      return false;
    } finally {
      if (showBusy && requestSeq === threadSaveRequestSeqRef.current) {
        setIsSavingThread(false);
      }
    }
  }

  async function saveThreadStateSilentlyIfNeeded(
    threadId: string,
  ): Promise<void> {
    const normalizedThreadId = threadId.trim();
    if (!normalizedThreadId) {
      return;
    }

    const snapshot = findThreadStateById(
      threadsRef.current,
      normalizedThreadId,
    );
    if (!snapshot) {
      return;
    }
    if (!shouldPersistThreadState(snapshot)) {
      return;
    }

    const signature = buildThreadSaveSignature(snapshot);
    const savedSignature =
      threadSaveSignatureByIdRef.current.get(normalizedThreadId);
    if (savedSignature === signature) {
      return;
    }

    await saveThreadStateToDatabase(snapshot, signature, {
      showBusy: false,
      reportError: false,
    });
  }

  async function flushActiveThreadState(): Promise<boolean> {
    const currentThreadId = activeThreadIdRef.current.trim();
    if (!currentThreadId) {
      return true;
    }

    clearThreadNameSaveTimeout();

    const baseThread = findThreadStateById(
      threadsRef.current,
      currentThreadId,
    );
    if (!baseThread) {
      return true;
    }

    const snapshot = buildThreadStateFromCurrentState(baseThread, {
      includeDraftName: true,
    });
    if (!shouldPersistThreadState(snapshot)) {
      return true;
    }
    const signature = buildThreadSaveSignature(snapshot);
    const savedSignature =
      threadSaveSignatureByIdRef.current.get(currentThreadId);
    if (savedSignature === signature) {
      return true;
    }

    clearThreadSaveTimeout();
    return await saveThreadStateToDatabase(snapshot, signature);
  }

  async function saveActiveThreadNameInBackground(
    threadId: string,
    name: string,
  ): Promise<void> {
    const normalizedThreadId = threadId.trim();
    const normalizedName = name.trim().slice(0, THREAD_NAME_MAX_LENGTH);
    if (!normalizedThreadId || !normalizedName) {
      return;
    }
    if (normalizedThreadId !== activeThreadIdRef.current.trim()) {
      return;
    }

    const baseThread = findThreadStateById(
      threadsRef.current,
      normalizedThreadId,
    );
    if (!baseThread || baseThread.name === normalizedName) {
      return;
    }
    if (!shouldPersistThreadState(baseThread)) {
      return;
    }

    const snapshot = buildThreadStateFromCurrentState(baseThread, {
      includeDraftName: true,
    });
    snapshot.name = normalizedName;

    const signature = buildThreadSaveSignature(snapshot);
    const savedSignature =
      threadSaveSignatureByIdRef.current.get(normalizedThreadId);
    if (savedSignature === signature) {
      return;
    }

    await saveThreadStateToDatabase(snapshot, signature);
  }

  async function refreshThreadTitleInBackground(options: {
    threadId: string;
    reason:
      | "first_message"
      | "instruction_update"
      | "utility_deployment_update";
    instructionOverride?: string;
  }): Promise<void> {
    const normalizedThreadId = options.threadId.trim();
    if (!normalizedThreadId) {
      return;
    }
    if (
      isArchivedThread(normalizedThreadId) ||
      isChatLocked ||
      isLoadingUtilityAzureDeployments
    ) {
      return;
    }

    const utilityConnection = activeUtilityAzureConnection;
    const deploymentName = selectedUtilityAzureDeploymentName.trim();
    if (
      !utilityConnection ||
      !deploymentName ||
      !includesAzureDeploymentName(utilityAzureDeployments, deploymentName)
    ) {
      return;
    }

    const baseThread = findThreadStateById(
      threadsRef.current,
      normalizedThreadId,
    );
    if (!baseThread || !hasThreadInteraction(baseThread)) {
      return;
    }

    const playgroundContent = buildThreadAutoTitlePlaygroundContent(
      baseThread.messages,
    );
    if (!playgroundContent) {
      return;
    }

    const instruction =
      typeof options.instructionOverride === "string"
        ? options.instructionOverride
        : normalizedThreadId === activeThreadIdRef.current.trim()
          ? agentInstruction
          : baseThread.agentInstruction;

    try {
      const response = await fetch("/api/threads/title-suggestions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          playgroundContent,
          instruction,
          azureConfig: {
            tenantId: activeAzureTenantIdRef.current,
            projectName: utilityConnection.projectName,
            baseUrl: utilityConnection.baseUrl,
            apiVersion: utilityConnection.apiVersion,
            deploymentName,
          },
          supportsReasoningEffort: isUtilityReasoningEffortSupported,
          ...(isUtilityReasoningEffortSupported
            ? { reasoningEffort: effectiveUtilityReasoningEffort }
            : {}),
        }),
      });

      const payload = (await response.json()) as ThreadTitleApiResponse;
      if (!response.ok || payload.error) {
        if (payload.errorCode === "azure_login_required") {
          if (
            options.reason === "utility_deployment_update" &&
            isSwitchingAzureTenant
          ) {
            reportAzureTenantSwitchPending();
          }
          return;
        }
        throw new Error(payload.error || "Failed to generate thread title.");
      }

      const nextTitle = normalizeThreadAutoTitle(
        typeof payload.title === "string" ? payload.title : "",
      );
      if (!nextTitle) {
        return;
      }

      const latestThread = findThreadStateById(
        threadsRef.current,
        normalizedThreadId,
      );
      if (!latestThread || latestThread.deletedAt !== null) {
        return;
      }

      const activeThreadId = activeThreadIdRef.current.trim();
      const currentInputName =
        normalizedThreadId === activeThreadId
          ? activeThreadNameInputRef.current.trim()
          : latestThread.name.trim();
      if (
        nextTitle === latestThread.name &&
        (!currentInputName || currentInputName === nextTitle)
      ) {
        return;
      }

      updateThreadStateById(normalizedThreadId, (thread) => ({
        ...thread,
        updatedAt: new Date().toISOString(),
        name: nextTitle,
      }));

      if (normalizedThreadId === activeThreadId) {
        setActiveThreadNameInput(nextTitle);
      }

      await saveActiveThreadNameInBackground(normalizedThreadId, nextTitle);
    } catch (threadTitleError) {
      logClientError("generate_thread_title_failed", threadTitleError, {
        action: "generate_thread_title",
        context: {
          threadId: normalizedThreadId,
          reason: options.reason,
        },
      });
    }
  }

  // Thread lifecycle actions (load/create/rename/archive/switch).
  async function loadThreads(): Promise<void> {
    const expectedUserKey = activeWorkspaceUserKeyRef.current.trim();
    if (!expectedUserKey) {
      clearThreadsState();
      return;
    }

    const requestSeq = threadLoadRequestSeqRef.current + 1;
    threadLoadRequestSeqRef.current = requestSeq;
    beginThreadOperation("loading");
    setThreadError(null);

    try {
      const { payload } = await requestClientApi<ThreadsApiResponse>({
        url: "/api/threads",
        init: {
          method: "GET",
        },
        readPayload: async (response) =>
          (await response.json()) as ThreadsApiResponse,
        resolveAuthRequired: (status, responsePayload) =>
          resolveAuthRequired(status, responsePayload),
        readErrorMessage: (responsePayload) =>
          typeof responsePayload.error === "string"
            ? responsePayload.error
            : null,
        fallbackErrorMessage: "Failed to load threads.",
        authRequiredMessage:
          "Azure login is required. Open Settings and sign in to load threads.",
        onAuthRequired: () => {
          markAzureAuthRequired();
          clearThreadsState(
            "Azure login is required. Open Settings and sign in to load threads.",
          );
        },
      });

      if (requestSeq !== threadLoadRequestSeqRef.current) {
        return;
      }
      if (expectedUserKey !== activeWorkspaceUserKeyRef.current.trim()) {
        return;
      }

      const parsedThreads = readThreadStateListFromResources(payload.threads, {
        fallbackInstruction: DEFAULT_AGENT_INSTRUCTION,
      });
      const nextThreads = parsedThreads.some(
        (thread) => thread.deletedAt === null,
      )
        ? parsedThreads
        : upsertThreadState(parsedThreads, createLocalThreadState());

      setThreadSaveSignatures(parsedThreads);
      setThreadsState(nextThreads);
      dispatchWorkspaceInteraction({
        type: "thread_request_state/prune",
        validThreadIds: nextThreads.map((thread) => thread.id),
      });
      isThreadsReadyRef.current = true;
      setThreadError(null);

      const preferredThreadId = activeThreadIdRef.current.trim();
      const nextThread =
        nextThreads.find((thread) => thread.id === preferredThreadId) ??
        nextThreads.find((thread) => thread.deletedAt === null) ??
        nextThreads[0];
      if (!nextThread) {
        throw new Error("No thread is available.");
      }

      applyThreadState(nextThread);
      logClientInfo("load_threads_succeeded", "Threads loaded.", {
        action: "load_threads",
        context: {
          threadCount: nextThreads.length,
          archivedThreadCount: nextThreads.filter(
            (thread) => thread.deletedAt !== null,
          ).length,
          activeThreadId: nextThread.id,
        },
      });
    } catch (loadError) {
      if (requestSeq !== threadLoadRequestSeqRef.current) {
        return;
      }
      if (expectedUserKey !== activeWorkspaceUserKeyRef.current.trim()) {
        return;
      }
      if (
        loadError instanceof ClientApiError &&
        loadError.kind === "auth_required"
      ) {
        return;
      }

      logClientError("load_threads_failed", loadError, {
        action: "load_threads",
        statusCode: 500,
      });
      setThreadError(mapApiError(loadError, "Failed to load threads."));
    } finally {
      if (requestSeq === threadLoadRequestSeqRef.current) {
        endThreadOperation("loading");
      }
    }
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
  async function saveMcpServerToConfig(
    server: McpServerConfig,
    options: {
      isUpdate?: boolean;
    } = {},
  ): Promise<{
    profile: McpServerConfig;
    warning: string | null;
  }> {
    const isUpdate = options.isUpdate === true;
    const endpoint = isUpdate
      ? `/api/mcp/servers/${encodeURIComponent(server.id)}`
      : "/api/mcp/servers";
    const method = isUpdate ? "PUT" : "POST";

    const result = await mcpServersApiClient.saveProfile(server, {
      isUpdate,
      onAuthRequired: () => {
        markAzureAuthRequired();
      },
    });

    const profile = result.profile;
    if (!profile) {
      throw new Error("Saved MCP server response is invalid.");
    }

    const profiles = result.profiles;
    if (profiles.length > 0) {
      applyWorkspaceMcpServerProfiles(profiles);
    } else {
      const nextWorkspaceMcpServerProfiles = upsertMcpServer(
        workspaceMcpServerProfilesRef.current,
        profile,
      );
      applyWorkspaceMcpServerProfiles(nextWorkspaceMcpServerProfiles);
    }

    return {
      profile,
      warning: result.warning,
    };
  }

  async function deleteWorkspaceMcpServerProfileFromConfig(
    serverId: string,
  ): Promise<McpServerConfig[]> {
    const result = await mcpServersApiClient.deleteProfile(serverId, {
      onAuthRequired: () => {
        markAzureAuthRequired();
      },
    });

    return result.profiles;
  }

  function connectMcpServerToAgent(serverToConnect: McpServerConfig) {
    const activeId = activeThreadIdRef.current.trim();
    if (!activeId) {
      return;
    }

    updateThreadStateById(activeId, (thread) => {
      const existingIndex = thread.mcpServers.findIndex(
        (server) =>
          buildMcpServerKey(server) === buildMcpServerKey(serverToConnect),
      );
      if (existingIndex >= 0) {
        return {
          ...thread,
          mcpServers: thread.mcpServers.map((server, index) =>
            index === existingIndex
              ? { ...server, name: serverToConnect.name }
              : server,
          ),
        };
      }

      return {
        ...thread,
        mcpServers: [...thread.mcpServers, serverToConnect],
      };
    });
  }

  async function sendMessage() {
    const threadId = activeThreadIdRef.current.trim();
    const content = draft.trim();
    const deploymentName = selectedPlaygroundAzureDeploymentName.trim();
    const preconditionViolation = validateSendPreconditions({
      content,
      threadId,
      isArchivedThread: isArchivedThread(threadId),
      isThreadSending: readThreadRequestState(threadId).isSending,
      isThreadPhaseBlockingSend:
        isThreadPhaseBlockingSend(threadOperationPhase),
      isChatLocked,
      hasActivePlaygroundAzureConnection: !!activePlaygroundAzureConnection,
      isAzureAuthRequired,
      isLoadingPlaygroundAzureDeployments,
      deploymentName,
      isSelectedDeploymentValid: includesAzureDeploymentName(
        playgroundAzureDeployments,
        deploymentName,
      ),
      isPlaygroundReasoningEffortSupported,
      isSelectedPlaygroundReasoningEffortOptionAvailable:
        effectivePlaygroundReasoningEffortOptions.includes(reasoningEffort),
      webSearchEnabled,
      isPlaygroundReasoningEffortWebSearchCompatible:
        !webSearchEnabled ||
        !isPlaygroundReasoningEffortSupported ||
        isWebSearchCompatibleReasoningEffort(reasoningEffort),
    });
    if (preconditionViolation) {
      if (
        preconditionViolation.type === "thread_error" &&
        preconditionViolation.message
      ) {
        setThreadError(preconditionViolation.message);
      }
      if (preconditionViolation.type === "ui_error") {
        setUiError(preconditionViolation.message);
      }
      if (preconditionViolation.targetTab) {
        setActiveMainTab(preconditionViolation.targetTab);
      }
      return;
    }

    if (
      !content ||
      !threadId ||
      !activePlaygroundAzureConnection ||
      !deploymentName
    ) {
      return;
    }

    const baseThread = findThreadStateById(threadsRef.current, threadId);
    const shouldRefreshThreadTitleOnFirstMessage =
      !!baseThread &&
      baseThread.deletedAt === null &&
      baseThread.messages.length === 0;

    const turnId = createId("turn");
    const requestAttachments = draftAttachments.map(
      ({ id: _id, ...attachment }) => attachment,
    );
    const requestMcpServers = cloneMcpServers(mcpServers);
    const requestMessageSkillActivations = cloneThreadSkillActivations(
      selectedMessageSkillActivations,
    );
    const requestSkillSelections = mergeSkillSelections(
      selectedThreadSkills,
      requestMessageSkillActivations,
    );
    const requestThreadEnvironment = baseThread
      ? cloneThreadEnvironment(baseThread.threadEnvironment)
      : {};
    const requestExplicitSkillLocations = requestSkillSelections.map(
      (selection) => selection.location,
    );
    const requestAgentInstruction = agentInstruction;
    const requestInstructionContextToggles = cloneThreadInstructionContexts(
      instructionContextToggles,
    );
    const userMessage: ThreadMessage = createThreadMessage(
      "user",
      content,
      turnId,
      requestAttachments,
      requestMessageSkillActivations,
    );
    const history = messages.map(
      ({ role, content: previousContent, attachments }) => {
        if (role === "user" && attachments.length > 0) {
          return {
            role,
            content: previousContent,
            attachments,
          };
        }

        return {
          role,
          content: previousContent,
        };
      },
    );

    appendMessageToThreadState(threadId, userMessage);
    setDraft("");
    setSelectedMessageSkillActivations([]);
    setDraftAttachments([]);
    setChatAttachmentError(null);
    setUiError(null);
    setSystemNotice(null);
    clearAzureSessionStatus();
    updateThreadRequestState(threadId, (current) =>
      applySendResult(current, {
        status: "optimistic",
        turnId,
      }),
    );
    logClientInfo("send_message_started", "Thread message request started.", {
      action: "send_message",
      context: {
        threadId,
        turnId,
        messageLength: content.length,
        historyCount: history.length,
        attachmentCount: requestAttachments.length,
        mcpServerCount: requestMcpServers.length,
        skillSelectionCount: requestSkillSelections.length,
      },
    });
    if (shouldRefreshThreadTitleOnFirstMessage) {
      void refreshThreadTitleInBackground({
        threadId,
        reason: "first_message",
      });
    }

    const sendAbortController = new AbortController();
    assignThreadSendAbortController(threadId, sendAbortController);

    try {
      const requestPayload = buildChatRequestPayload({
        threadId,
        turnId,
        message: content,
        attachments: requestAttachments,
        history,
        azureConfig: {
          tenantId: activeAzureTenantIdRef.current,
          projectName: activePlaygroundAzureConnection.projectName,
          baseUrl: activePlaygroundAzureConnection.baseUrl,
          apiVersion: activePlaygroundAzureConnection.apiVersion,
          deploymentName,
        },
        supportsReasoningEffort: isPlaygroundReasoningEffortSupported,
        reasoningEffort,
        webSearchEnabled,
        agentInstruction: requestAgentInstruction,
        instructionContextToggles: requestInstructionContextToggles,
        threadEnvironment: requestThreadEnvironment,
        skills: requestSkillSelections,
        explicitSkillLocations: requestExplicitSkillLocations,
        mcpServers: serializeMcpServersForChatRequest(requestMcpServers),
      });

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream, application/json",
        },
        signal: sendAbortController.signal,
        body: JSON.stringify(requestPayload),
      });

      const { payload, isEventStream, operationLogCount } =
        await consumeChatResponseStream({
          response,
          readChatEventStreamPayload: (streamResponse, handlers) =>
            readChatEventStreamPayload(streamResponse, handlers),
          readJsonPayload: (jsonResponse) =>
            readJsonPayload<ChatApiResponse>(jsonResponse, "chat"),
          onProgress: (message) => {
            appendThreadProgressMessage(threadId, message);
          },
          onOperationLogRecord: (entry) => {
            appendThreadOperationLogToThreadState(threadId, {
              ...entry,
              turnId,
            });
          },
        });

      if (!response.ok || payload.error) {
        if (payload.errorCode === "azure_login_required") {
          markAzureAuthRequired();
        }
        throw new Error(payload.error || "Failed to send message.");
      }

      if (!payload.message) {
        throw new Error("The server returned an empty message.");
      }

      applyThreadEnvironmentToThreadState(
        threadId,
        "threadEnvironment" in payload
          ? payload.threadEnvironment
          : requestThreadEnvironment,
      );
      const assistantMessage = createThreadMessage(
        "assistant",
        payload.message,
        turnId,
      );
      appendMessageToThreadState(threadId, assistantMessage);
      updateThreadRequestState(threadId, (current) =>
        applySendResult(current, {
          status: "succeeded",
        }),
      );
      logClientInfo(
        "send_message_succeeded",
        "Thread message request completed.",
        {
          action: "send_message",
          context: {
            threadId,
            turnId,
            responseLength: payload.message.length,
            operationLogCount,
            usedEventStream: isEventStream,
          },
        },
      );
    } catch (sendError) {
      const wasCanceled = sendAbortController.signal.aborted;
      if (wasCanceled) {
        logClientInfo(
          "send_message_canceled",
          "Thread message request canceled.",
          {
            action: "send_message_cancel",
            context: {
              threadId,
              turnId,
            },
          },
        );
        updateThreadRequestState(threadId, (current) =>
          applySendResult(current, {
            status: "canceled",
          }),
        );
        return;
      }

      logClientError("send_message_failed", sendError, {
        action: "send_message",
        context: {
          threadId,
          turnId,
          messageLength: content.length,
          attachmentCount: requestAttachments.length,
          skillSelectionCount: requestSkillSelections.length,
        },
      });
      updateThreadRequestState(threadId, (current) =>
        applySendResult(current, {
          status: "failed",
          turnId,
          error: sendError,
        }),
      );
    } finally {
      clearThreadSendAbortController(threadId, sendAbortController);
      window.setTimeout(() => {
        void saveThreadStateSilentlyIfNeeded(threadId);
      }, 0);
    }
  }

  function handleReloadSkills() {
    const now = Date.now();
    if (
      now - lastManualSkillsReloadAtRef.current <
      CLIENT_SKILLS_RELOAD_MIN_INTERVAL_MS
    ) {
      return;
    }
    lastManualSkillsReloadAtRef.current = now;
    void loadAvailableSkills({
      forceRefresh: true,
    });
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
    loadWorkspaceMcpServerProfiles,
    clearMcpServerEditState,
    setEditingMcpServerId,
    populateMcpServerFormForEdit,
    setMcpFormError,
    setMcpFormWarning,
    setIsDeletingWorkspaceMcpServerProfile,
    setIsSavingMcpServer,
    applyWorkspaceMcpServerProfiles,
    deleteWorkspaceMcpServerProfileFromConfig,
    saveMcpServerToConfig,
    connectMcpServerToAgent,
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

  function handleChatProjectChange(projectId: string) {
    handleSelectPlaygroundProject(projectId);
    setUiError(null);
  }

  function handleChatDeploymentChange(nextDeploymentNameRaw: string) {
    const nextDeploymentName = nextDeploymentNameRaw.trim();
    handleSelectPlaygroundDeployment(nextDeploymentName);
    setUiError(null);
  }

  function handleUtilityProjectChange(projectId: string) {
    handleSelectUtilityProject(projectId);
    setInstructionEnhanceError(null);
  }

  function handleUtilityDeploymentChange(nextDeploymentNameRaw: string) {
    const nextDeploymentName = nextDeploymentNameRaw.trim();
    handleSelectUtilityDeployment(nextDeploymentName);
    setInstructionEnhanceError(null);
  }

  function handleUtilityReasoningEffortChange(nextValue: ReasoningEffort) {
    if (!isUtilityReasoningEffortSupported) {
      return;
    }
    if (!effectiveUtilityReasoningEffortOptions.includes(nextValue)) {
      return;
    }
    handleAzureUtilityReasoningEffortChange(nextValue);
    setInstructionEnhanceError(null);
  }

  function handleReasoningEffortChange(nextValue: ReasoningEffort) {
    if (!isPlaygroundReasoningEffortSupported) {
      return;
    }
    if (!effectivePlaygroundReasoningEffortOptions.includes(nextValue)) {
      return;
    }
    setReasoningEffort(nextValue);
    setUiError(null);
  }

  function handleWebSearchEnabledChange(nextValue: boolean) {
    if (
      nextValue &&
      isPlaygroundReasoningEffortSupported &&
      filterReasoningEffortOptionsForWebSearch(
        selectedPlaygroundDeploymentCompatibleReasoningEffortOptions,
        true,
      ).length === 0
    ) {
      setUiError("Web Search is not available for the selected deployment.");
      return;
    }

    if (
      nextValue &&
      isPlaygroundReasoningEffortSupported &&
      !isWebSearchCompatibleReasoningEffort(reasoningEffort)
    ) {
      setUiError(
        "Selected Reasoning Effort cannot be used with Web Search. Choose a compatible value first.",
      );
      return;
    }

    setWebSearchEnabled(nextValue);
    setUiError(null);
  }

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

  async function handleSaveInstructionPrompt() {
    if (isArchivedThread(activeThreadIdRef.current)) {
      return;
    }

    if (isSavingInstructionPrompt) {
      return;
    }

    setInstructionSaveError(null);
    setInstructionSaveSuccess(null);

    if (!agentInstruction.trim()) {
      setInstructionSaveError("Instruction is empty.");
      return;
    }

    setIsSavingInstructionPrompt(true);

    try {
      const sourceFileName = resolveInstructionSourceFileName(
        loadedInstructionFileName,
      );
      const suggestedFileName = buildInstructionSuggestedFileName(
        sourceFileName,
        agentInstruction,
      );
      const saveResult = await saveInstructionToClientFile(
        agentInstruction,
        suggestedFileName,
      );
      setLoadedInstructionFileName(saveResult.fileName);
      setInstructionSaveSuccess(
        saveResult.mode === "picker"
          ? `Saved as ${saveResult.fileName}`
          : `Download started: ${saveResult.fileName}`,
      );
    } catch (saveError) {
      if (isInstructionSaveCanceled(saveError)) {
        return;
      }
      logClientError("save_instruction_file_failed", saveError, {
        action: "save_instruction_file",
      });
      setInstructionSaveError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save instruction prompt.",
      );
    } finally {
      setIsSavingInstructionPrompt(false);
    }
  }

  async function handleEnhanceInstruction() {
    const enhanceThreadId = activeThreadIdRef.current.trim();
    if (!enhanceThreadId || isArchivedThread(enhanceThreadId)) {
      return;
    }

    if (isEnhancingInstruction) {
      return;
    }

    setInstructionEnhanceError(null);
    setInstructionEnhanceSuccess(null);
    setInstructionEnhanceComparison(null);

    const currentInstruction = agentInstruction.trim();
    if (!currentInstruction) {
      setInstructionEnhanceError("Instruction is empty.");
      return;
    }

    if (isChatLocked) {
      setActiveMainTab("settings");
      setInstructionEnhanceError(
        "Playground is unavailable while logged out. Open Azure Connection and sign in first.",
      );
      return;
    }

    if (!activeUtilityAzureConnection) {
      setInstructionEnhanceError("No Utility project is selected.");
      return;
    }

    const deploymentName = selectedUtilityAzureDeploymentName.trim();
    if (isLoadingUtilityAzureDeployments) {
      setInstructionEnhanceError(
        "Utility deployment list is loading. Please wait.",
      );
      return;
    }

    if (
      !deploymentName ||
      !includesAzureDeploymentName(utilityAzureDeployments, deploymentName)
    ) {
      setInstructionEnhanceError(
        "Select a Utility deployment before enhancing.",
      );
      return;
    }

    const sourceFileName = resolveInstructionSourceFileName(
      loadedInstructionFileName,
    );
    const instructionExtension = resolveInstructionFormatExtension(
      sourceFileName,
      currentInstruction,
    );
    const instructionLanguage = detectInstructionLanguage(currentInstruction);
    const enhanceRequestMessage = buildInstructionEnhanceMessage({
      instruction: currentInstruction,
      extension: instructionExtension,
      language: instructionLanguage,
    });

    setInstructionEnhancingThreadId(enhanceThreadId);
    setIsEnhancingInstruction(true);

    try {
      const response = await fetch("/api/instruction-patches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          message: enhanceRequestMessage,
          azureConfig: {
            tenantId: activeAzureTenantIdRef.current,
            projectName: activeUtilityAzureConnection.projectName,
            baseUrl: activeUtilityAzureConnection.baseUrl,
            apiVersion: activeUtilityAzureConnection.apiVersion,
            deploymentName,
          },
          supportsReasoningEffort: isUtilityReasoningEffortSupported,
          ...(isUtilityReasoningEffortSupported
            ? { reasoningEffort: effectiveUtilityReasoningEffort }
            : {}),
          enhanceAgentInstruction: INSTRUCTION_ENHANCE_SYSTEM_PROMPT,
        }),
      });

      const payload = (await response.json()) as ChatApiResponse;
      if (!response.ok || payload.error) {
        if (payload.errorCode === "azure_login_required") {
          markAzureAuthRequired();
        }

        throw new Error(payload.error || "Failed to enhance instruction.");
      }

      const rawInstructionPatch =
        typeof payload.message === "string" ? payload.message : "";
      const normalizedInstructionPatch =
        normalizeInstructionDiffPatchResponse(rawInstructionPatch);
      if (!normalizedInstructionPatch) {
        setInstructionEnhanceSuccess("No changes were suggested.");
        return;
      }

      const patchApplyResult = applyInstructionUnifiedDiffPatch(
        currentInstruction,
        normalizedInstructionPatch,
      );
      if (!patchApplyResult.ok) {
        throw new Error(patchApplyResult.error);
      }
      const normalizedEnhancedInstruction = patchApplyResult.value;
      const formatValidation = validateEnhancedInstructionFormat(
        normalizedEnhancedInstruction,
        instructionExtension,
      );
      if (!formatValidation.ok) {
        throw new Error(formatValidation.error);
      }

      if (normalizedEnhancedInstruction === currentInstruction) {
        setInstructionEnhanceSuccess("No changes were suggested.");
        return;
      }

      setInstructionEnhanceComparison({
        original: currentInstruction,
        enhanced: normalizedEnhancedInstruction,
        extension: instructionExtension,
        language: instructionLanguage,
        diffPatch: normalizedInstructionPatch,
      });
      setInstructionFileError(null);
      setInstructionSaveError(null);
      setInstructionSaveSuccess(null);
      setInstructionEnhanceSuccess(
        "Review the diff and choose which version to adopt.",
      );
    } catch (enhanceError) {
      logClientError("enhance_instruction_failed", enhanceError, {
        action: "enhance_instruction",
      });
      setInstructionEnhanceError(
        enhanceError instanceof Error
          ? enhanceError.message
          : "Failed to enhance instruction.",
      );
    } finally {
      setIsEnhancingInstruction(false);
      setInstructionEnhancingThreadId("");
    }
  }

  function handleAdoptEnhancedInstruction() {
    if (isArchivedThread(activeThreadIdRef.current)) {
      return;
    }

    if (!instructionEnhanceComparison) {
      return;
    }

    const enhancedInstruction = instructionEnhanceComparison.enhanced;
    const currentThreadId = activeThreadIdRef.current.trim();
    setAgentInstruction(enhancedInstruction);
    setInstructionEnhanceComparison(null);
    setInstructionEnhanceError(null);
    setInstructionSaveError(null);
    setInstructionSaveSuccess(null);
    setInstructionEnhanceSuccess("Enhanced instruction applied.");
    if (currentThreadId) {
      void refreshThreadTitleInBackground({
        threadId: currentThreadId,
        reason: "instruction_update",
        instructionOverride: enhancedInstruction,
      });
    }
  }

  function handleAdoptOriginalInstruction() {
    if (isArchivedThread(activeThreadIdRef.current)) {
      return;
    }

    if (!instructionEnhanceComparison) {
      return;
    }

    const originalInstruction = instructionEnhanceComparison.original;
    const currentThreadId = activeThreadIdRef.current.trim();
    setAgentInstruction(originalInstruction);
    setInstructionEnhanceComparison(null);
    setInstructionEnhanceError(null);
    setInstructionSaveError(null);
    setInstructionSaveSuccess(null);
    setInstructionEnhanceSuccess("Kept original instruction.");
    if (currentThreadId) {
      void refreshThreadTitleInBackground({
        threadId: currentThreadId,
        reason: "instruction_update",
        instructionOverride: originalInstruction,
      });
    }
  }

  async function handleApplyDesktopUpdate() {
    const desktopApi = readDesktopApi();
    if (
      !desktopApi ||
      !desktopUpdaterStatus.updateDownloaded ||
      isApplyingDesktopUpdate
    ) {
      return;
    }

    setIsApplyingDesktopUpdate(true);
    setUiError(null);
    try {
      await desktopApi.quitAndInstallUpdate();
    } catch (error) {
      logClientError("desktop_update_apply_failed", error, {
        action: "desktop_updater.quitAndInstallUpdate",
        location: "controller.desktopUpdater",
        context: {
          availableVersion: desktopUpdaterStatus.availableVersion,
        },
      });
      setUiError(
        error instanceof Error
          ? error.message
          : "Failed to apply desktop update.",
      );
      setIsApplyingDesktopUpdate(false);
    }
  }

  async function handleCheckDesktopUpdates() {
    const desktopApi = readDesktopApi();
    if (
      !desktopApi ||
      !desktopUpdaterStatus.supported ||
      desktopUpdaterStatus.checking
    ) {
      return;
    }

    setUiError(null);
    try {
      const payload = await desktopApi.checkForUpdates();
      const parsed = readDesktopUpdaterStatusFromUnknown(payload);
      if (!parsed) {
        setSystemNotice("Update check completed.");
        return;
      }

      setDesktopUpdaterStatus(parsed);

      if (parsed.errorMessage) {
        setUiError(parsed.errorMessage);
        return;
      }

      if (parsed.updateDownloaded) {
        setSystemNotice(
          parsed.availableVersion
            ? `Version ${parsed.availableVersion} is downloaded. Use Upgrade to apply it.`
            : "An update is downloaded. Use Upgrade to apply it.",
        );
        return;
      }

      if (parsed.updateAvailable) {
        setSystemNotice(
          parsed.availableVersion
            ? `Version ${parsed.availableVersion} is available and downloading in the background.`
            : "A new version is available and downloading in the background.",
        );
        return;
      }

      setSystemNotice(
        parsed.currentVersion
          ? `No updates found. Current version is ${parsed.currentVersion}.`
          : "No updates found.",
      );
    } catch (error) {
      logClientError("desktop_update_check_failed", error, {
        action: "desktop_updater.checkForUpdates",
        location: "controller.desktopUpdater",
        context: {
          currentVersion: desktopUpdaterStatus.currentVersion,
        },
      });
      setUiError(
        error instanceof Error
          ? error.message
          : "Failed to check desktop updates.",
      );
    }
  }

  function handleMainSplitterPointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    event.preventDefault();
    const layoutElement = layoutRef.current;
    if (!layoutElement) {
      return;
    }

    const rect = layoutElement.getBoundingClientRect();
    const maxRightWidth = resolveMainSplitterMaxRightWidth(rect.width);
    setActiveResizeHandle("main");

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextRightWidth = rect.right - moveEvent.clientX;
      setRightPaneWidth(
        clampNumber(
          nextRightWidth,
          CLIENT_MAIN_SPLITTER_MIN_RIGHT_WIDTH_PX,
          maxRightWidth,
        ),
      );
    };

    const stopResizing = () => {
      setActiveResizeHandle(null);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResizing);
      window.removeEventListener("pointercancel", stopResizing);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResizing);
    window.addEventListener("pointercancel", stopResizing);
  }

  function handleChatAzureSelectorAction(target: "project" | "deployment") {
    if (
      isSending ||
      isStartingAzureLogin ||
      isSwitchingAzureTenant ||
      isStartingAzureLogout ||
      isLoadingAzureConnections ||
      isLoadingPlaygroundAzureDeployments
    ) {
      return;
    }

    setUiError(null);
    setSystemNotice(null);
    clearAzureSessionStatus();

    if (
      isAzureAuthRequired ||
      isLikelyChatAzureAuthError(azureConnectionError)
    ) {
      markAzureAuthRequired();
      setActiveMainTab("settings");
      void handleAzureLogin();
      return;
    }

    const needsProjectReload =
      azureConnections.length === 0 || !activePlaygroundAzureConnection;
    const needsDeploymentReload =
      target === "deployment" &&
      (!activePlaygroundAzureConnection ||
        playgroundAzureDeployments.length === 0 ||
        !selectedPlaygroundAzureDeploymentName.trim());

    if (needsProjectReload || needsDeploymentReload) {
      void loadAzureProjects({ force: true });
    }
  }

  const handleCopyMessage = (content: string) => {
    void copyTextToClipboard(content).catch(() => {
      setUiError("Failed to copy text to clipboard.");
    });
  };

  const handleCopyMcpLog = (text: string) => {
    void copyTextToClipboard(text).catch(() => {
      setUiError("Failed to copy MCP log to clipboard.");
    });
  };

  // Panel prop composition for Client route rendering.
  const settingsTabProps = buildSettingsTabProps({
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
    isLoadingAzureDeployments:
      isLoadingPlaygroundAzureDeployments || isLoadingUtilityAzureDeployments,
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
    onUtilityProjectChange: handleUtilityProjectChange,
    onUtilityDeploymentChange: handleUtilityDeploymentChange,
    onUtilityReasoningEffortChange: handleUtilityReasoningEffortChange,
    isLoadingUtilityAzureDeployments,
  });

  const mcpServersTabProps = buildMcpServersTabProps({
    workspaceMcpServerProfileOptions,
    selectedWorkspaceMcpServerProfileCount,
    isSending,
    isThreadReadOnly: isActiveThreadArchived,
    isLoadingWorkspaceMcpServerProfiles,
    isMutatingWorkspaceMcpServerProfiles,
    workspaceMcpServerProfileError,
    onToggleWorkspaceMcpServerProfile: handleToggleWorkspaceMcpServerProfile,
    onEditWorkspaceMcpServerProfile: handleEditWorkspaceMcpServerProfile,
    onDeleteWorkspaceMcpServerProfile: (serverId: string) => {
      void handleDeleteWorkspaceMcpServerProfile(serverId);
    },
    onReloadWorkspaceMcpServerProfiles: handleReloadWorkspaceMcpServerProfiles,
    isEditingMcpServer,
    editingMcpServerName,
    mcpNameInput,
    onMcpNameInputChange: setMcpNameInput,
    mcpTransport,
    onMcpTransportChange: (value: McpTransport) => {
      setMcpTransport(value);
      setMcpFormError(null);
    },
    mcpCommandInput,
    onMcpCommandInputChange: setMcpCommandInput,
    mcpArgsInput,
    onMcpArgsInputChange: setMcpArgsInput,
    mcpCwdInput,
    onMcpCwdInputChange: setMcpCwdInput,
    mcpEnvInput,
    onMcpEnvInputChange: setMcpEnvInput,
    mcpUrlInput,
    onMcpUrlInputChange: setMcpUrlInput,
    mcpHeadersInput,
    onMcpHeadersInputChange: setMcpHeadersInput,
    mcpUseAzureAuthInput,
    onMcpUseAzureAuthInputChange: (checked: boolean) => {
      setMcpUseAzureAuthInput(checked);
      if (checked && !mcpAzureAuthScopeInput.trim()) {
        setMcpAzureAuthScopeInput(MCP_DEFAULT_AZURE_AUTH_SCOPE);
      }
    },
    mcpAzureAuthScopeInput,
    onMcpAzureAuthScopeInputChange: setMcpAzureAuthScopeInput,
    mcpTimeoutSecondsInput,
    onMcpTimeoutSecondsInputChange: setMcpTimeoutSecondsInput,
    defaultMcpAzureAuthScope: MCP_DEFAULT_AZURE_AUTH_SCOPE,
    defaultMcpTimeoutSeconds: MCP_DEFAULT_TIMEOUT_SECONDS,
    minMcpTimeoutSeconds: MCP_TIMEOUT_SECONDS_MIN,
    maxMcpTimeoutSeconds: MCP_TIMEOUT_SECONDS_MAX,
    onAddMcpServer: handleAddMcpServer,
    onCancelMcpServerEdit: handleCancelMcpServerEdit,
    isSavingMcpServer,
    mcpFormError,
    mcpFormWarning,
    onClearMcpFormWarning: () => {
      setMcpFormWarning(null);
    },
  });

  const threadsTabProps = buildThreadsTabProps({
    agentInstruction,
    instructionContextToggles,
    instructionEnhanceComparison,
    describeInstructionLanguage,
    isSending,
    isThreadReadOnly: isActiveThreadArchived,
    isEnhancingInstruction,
    showEnhancingInstructionSpinner: isEnhancingInstructionForActiveThread,
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
    onClearInstructionSaveSuccess: () => {
      setInstructionSaveSuccess(null);
    },
    onClearInstructionEnhanceSuccess: () => {
      setInstructionEnhanceSuccess(null);
    },
    onInstructionContextToggleChange: handleInstructionContextToggleChange,
    onAgentInstructionChange: handleAgentInstructionChange,
    onInstructionFileChange: handleInstructionFileChange,
    onSaveInstructionPrompt: handleSaveInstructionPrompt,
    onEnhanceInstruction: handleEnhanceInstruction,
    onClearInstruction: handleClearInstruction,
    onAdoptEnhancedInstruction: handleAdoptEnhancedInstruction,
    onAdoptOriginalInstruction: handleAdoptOriginalInstruction,
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
    onActiveThreadChange: (threadId: string) => {
      void handleThreadChange(threadId);
    },
    onCreateThread: () => {
      void handleCreateThread();
    },
    onThreadRename: (threadId: string, nextName: string) => {
      void handleThreadRename(threadId, nextName);
    },
    onThreadCancel: (threadId: string) => {
      handleThreadCancel(threadId);
    },
    onThreadDelete: (threadId: string) => {
      void handleThreadLogicalDelete(threadId);
    },
    onThreadClear: (threadId: string) => {
      void handleThreadClear(threadId);
    },
    onThreadRestore: (threadId: string) => {
      void handleThreadRestore(threadId);
    },
  });

  const skillsTabProps = buildSkillsTabProps({
    threadSkillOptions,
    isLoadingSkills,
    isSending,
    isThreadReadOnly: isActiveThreadArchived,
    skillsError,
    skillsWarning,
    onReloadSkills: handleReloadSkills,
    onToggleThreadSkill: handleToggleThreadSkill,
    onClearSkillsWarning: () => {
      setSkillsWarning(null);
    },
    skillRegistryGroups,
    isMutatingSkillRegistries,
    skillRegistryError,
    skillRegistryWarning,
    skillRegistrySuccess,
    onToggleRegistrySkill: handleToggleRegistrySkill,
    onClearSkillRegistryWarning: () => {
      setSkillRegistryWarning(null);
    },
    onClearSkillRegistrySuccess: () => {
      setSkillRegistrySuccess(null);
    },
  });

  const playgroundPanelProps = buildPlaygroundPanelProps({
    messages,
    threadOperationLogsByTurnId,
    isSending,
    isThreadReadOnly: isActiveThreadArchived,
    desktopUpdaterStatus,
    desktopUpdaterActionState:
      resolveDesktopUpdaterActionState(desktopUpdaterStatus),
    isApplyingDesktopUpdate,
    onCheckDesktopUpdates: () => {
      void handleCheckDesktopUpdates();
    },
    onApplyDesktopUpdate: () => {
      void handleApplyDesktopUpdate();
    },
    activeThreadName: activeThreadNameInput,
    isThreadOperationBusy,
    isCreatingThread,
    onCreateThread: () => {
      void handleCreateThread();
    },
    onCancelThreadProcessing: () => {
      handleThreadCancel(activeThreadIdRef.current);
    },
    onCopyMessage: handleCopyMessage,
    onCopyOperationLog: handleCopyMcpLog,
    sendProgressMessages,
    activeTurnOperationLogs,
    errorTurnOperationLogs,
    endOfMessagesRef,
    systemNotice,
    onClearSystemNotice: () => {
      setSystemNotice(null);
    },
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
    onCompositionStart: () => setIsComposing(true),
    onCompositionEnd: () => setIsComposing(false),
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
    maxMessageAttachmentFiles: CHAT_ATTACHMENT_MAX_FILES,
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
    isMainSplitterResizing: activeResizeHandle === "main",
    onMainSplitterPointerDown: handleMainSplitterPointerDown,
    isAzureAuthRequired,
    theme,
    unauthenticatedPanelProps,
    configPanelProps: {
      activeMainTab,
      onMainTabChange: setActiveMainTab,
      isChatLocked,
      settingsTabProps,
      mcpServersTabProps,
      skillsTabProps,
      threadsTabProps,
    },
    playgroundPanelProps,
  };
}
