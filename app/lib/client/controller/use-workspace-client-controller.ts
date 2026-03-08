/**
 * Client controller runtime module.
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type SyntheticEvent,
} from "react";
import type {
  ThemeMode,
  MainViewTab,
  McpTransport,
  ReasoningEffort,
} from "~/lib/client/shared/view-types";
import { CHAT_ATTACHMENT_ALLOWED_EXTENSIONS, CHAT_ATTACHMENT_MAX_FILES, CHAT_ATTACHMENT_MAX_FILE_NAME_LENGTH, CHAT_ATTACHMENT_MAX_NON_PDF_FILE_SIZE_BYTES, CHAT_ATTACHMENT_MAX_PDF_FILE_SIZE_BYTES, CHAT_ATTACHMENT_MAX_PDF_TOTAL_SIZE_BYTES, CHAT_ATTACHMENT_MAX_TOTAL_SIZE_BYTES, DEFAULT_AGENT_INSTRUCTION, HOME_DEFAULT_REASONING_EFFORT, HOME_DEFAULT_UTILITY_REASONING_EFFORT, HOME_DEFAULT_WEB_SEARCH_ENABLED, HOME_REASONING_EFFORT_OPTIONS, THREAD_DEFAULT_NAME } from "~/lib/constants/chat";
import { HOME_CHAT_INPUT_MAX_HEIGHT_PX, HOME_CHAT_INPUT_MIN_HEIGHT_PX, HOME_DEFAULT_THEME, HOME_DEFAULT_THREAD_REQUEST_STATE, HOME_INITIAL_MESSAGES, HOME_MAIN_SPLITTER_MIN_RIGHT_WIDTH_PX, HOME_THREAD_NAME_MAX_LENGTH } from "~/lib/constants/client";
import { INSTRUCTION_ALLOWED_EXTENSIONS, INSTRUCTION_ENHANCE_SYSTEM_PROMPT, INSTRUCTION_MAX_FILE_SIZE_BYTES, INSTRUCTION_MAX_FILE_SIZE_LABEL } from "~/lib/constants/instruction";
import { HOME_DEFAULT_MCP_TRANSPORT, MCP_DEFAULT_AZURE_AUTH_SCOPE, MCP_DEFAULT_TIMEOUT_SECONDS, MCP_TIMEOUT_SECONDS_MAX, MCP_TIMEOUT_SECONDS_MIN } from "~/lib/constants/mcp";
import { HOME_SKILLS_RELOAD_MIN_INTERVAL_MS } from "~/lib/constants/skills";
import type {
  AzureDeploymentOption,
  AzureProjectOption,
  AzurePrincipalProfile,
  AzureSelectionPreference,
  AzureTenantOption,
} from "~/lib/client/azure/parsers";
import {
  readAzureDeploymentList,
  readAzurePrincipalProfileFromUnknown,
  readPrincipalIdFromUnknown,
  readAzureProjectList,
  readAzureSelectionFromUnknown,
  readAzureTenantList,
  readTenantIdFromUnknown,
} from "~/lib/client/azure/parsers";
import { isLikelyChatAzureAuthError } from "~/lib/client/azure/errors";
import { buildThreadOperationLogsByTurnId } from "~/lib/client/chat/history";
import type { DraftChatAttachment } from "~/lib/client/chat/attachments";
import { formatChatAttachmentSize, readFileAsDataUrl } from "~/lib/client/chat/attachments";
import {
  readChatCommandMatchAtCursor,
  replaceChatCommandToken,
} from "~/lib/client/chat/commands";
import type { ThreadMessage } from "~/lib/client/chat/messages";
import { createThreadMessage } from "~/lib/client/chat/messages";
import type { ChatApiResponse, ThreadOperationLogEntry } from "~/lib/client/chat/stream";
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
} from "~/lib/client/instruction/helpers";
import { resolveMainSplitterMaxRightWidth } from "~/lib/client/layout/main-splitter";
import {
  parseAzureAuthScopeInput,
  parseHttpHeadersInput,
  parseMcpTimeoutSecondsInput,
} from "~/lib/client/mcp/http-inputs";
import type { McpServerConfig } from "~/lib/client/mcp/profile";
import {
  buildMcpServerKey,
  readMcpServerFromUnknown,
  readMcpServerList,
  serializeMcpServerForSave,
  upsertMcpServer,
} from "~/lib/client/mcp/profile";
import {
  parseStdioArgsInput,
  parseStdioEnvInput,
} from "~/lib/client/mcp/stdio-inputs";
import {
  buildWorkspaceMcpServerProfileOptions,
  countSelectedWorkspaceMcpServerProfileOptions,
  isMcpServersAuthRequired,
  shouldScheduleWorkspaceMcpServerProfileLoginRetry,
} from "~/lib/client/mcp/workspace-mcp-server-profiles";
import {
  installGlobalClientErrorLogging,
  reportClientEvent,
  reportClientError,
  reportClientWarning,
} from "~/lib/client/observability/runtime-event-log-client";
import {
  buildThreadSummary,
  readThreadSnapshotFromUnknown,
  readThreadSnapshotList,
} from "~/lib/client/threads/parsers";
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
  isThreadSnapshotArchived,
  readThreadRuntimeStateById,
  updateThreadSnapshotCollectionById,
  upsertThreadSnapshot,
} from "~/lib/client/threads/snapshot-state";
import { readThreadEnvironmentFromUnknown } from "~/lib/client/threads/environment";
import {
  DEFAULT_THREAD_INSTRUCTION_CONTEXT_TOGGLES,
  THREAD_INSTRUCTION_CONTEXT_OPTIONS,
  type ThreadInstructionContextToggleKey,
} from "~/lib/client/threads/instruction-context";
import {
  buildThreadAutoTitlePlaygroundContent,
  normalizeThreadAutoTitle,
} from "~/lib/client/threads/title";
import type { ThreadSnapshot, ThreadSummary } from "~/lib/client/threads/types";
import { readSkillCatalogList, readSkillRegistryCatalogList } from "~/lib/client/skills/parsers";
import {
  readSkillRegistryOptionById,
  readSkillRegistryLabelFromSkillLocation,
  SKILL_REGISTRY_OPTIONS,
  type SkillRegistryId,
} from "~/lib/client/skills/registry";
import type {
  SkillCatalogEntry,
  SkillRegistryCatalog,
  ThreadSkillActivation,
} from "~/lib/client/skills/types";
import { copyTextToClipboard } from "~/lib/client/shared/clipboard";
import { readStringList } from "~/lib/client/shared/collections";
import { getFileExtension } from "~/lib/client/shared/files";
import { createId } from "~/lib/client/shared/ids";
import { clampNumber } from "~/lib/client/shared/numbers";
import {
  getDefaultDesktopUpdaterStatus,
  readDesktopApi,
  readDesktopUpdaterStatusFromUnknown,
} from "~/lib/client/controller/desktop-updater";
import {
  buildAzureProjectsLoadResult,
  isAzureProjectsLoadReady,
  resolveAzureAuthRequiredState,
  resolveAzureTenantOptions,
  resolveInitialAzureProjectId,
  shouldUseCachedAzureProjectCatalog,
  type AzureProjectsLoadResult,
} from "~/lib/client/controller/azure-runtime";
import { serializeMcpServersForChatRequest } from "~/lib/client/controller/mcp-runtime";
import { deriveInstructionRuntimeUiState } from "~/lib/client/controller/instruction-runtime";
import {
  canTransition,
  canStartThreadOperation,
  transitionThreadOperation,
  type ThreadOperationPhase,
} from "~/lib/client/controller/thread-operation-phase";
import {
  canSendMessageByGuard,
  isThreadPhaseBlockingSend,
  selectThreadOperationPhaseFlags,
  shouldBlockThreadPersistence,
} from "~/lib/client/controller/thread-guards";
import {
  buildThreadListOptions,
  findThreadSnapshotById,
  mergeSkillSelections,
} from "~/lib/client/controller/thread-runtime";
import {
  applySendResult,
  buildChatRequestPayload,
  consumeChatResponseStream,
  validateSendPreconditions,
} from "~/lib/client/controller/send-message-usecase";
import {
  ClientApiError,
  mapApiError,
  requestClientApi,
  resolveAuthRequired,
} from "~/lib/client/controller/api-client";
import { readJsonPayload } from "~/lib/client/controller/http";
import {
  type AzureActionApiResponse,
  type AzureProjectsApiResponse,
  type AzureSelectionApiResponse,
  type InstructionEnhanceComparison,
  type McpServersApiResponse,
  type SkillsApiResponse,
  type ThreadRequestState,
  type ThreadTitleApiResponse,
  type ThreadsApiResponse,
} from "~/lib/client/controller/types";

type ChatCommandSuggestion = {
  id: string;
  label: string;
  description: string;
  detail: string;
  isSelected: boolean;
  isAvailable: boolean;
};

type ChatCommandProvider = {
  keyword: string;
  emptyHint: string;
  readSuggestions: (query: string) => ChatCommandSuggestion[];
  applySuggestion: (suggestion: ChatCommandSuggestion) => void;
};

type AzureProjectCatalogCacheEntry = {
  tenantId: string;
  principalId: string;
  principal: AzurePrincipalProfile | null;
  tenants: AzureTenantOption[];
  projects: AzureProjectOption[];
};

type AzureProjectCatalogCacheByTenantId = Record<string, AzureProjectCatalogCacheEntry>;
type AzureDeploymentCatalogCacheByTenantProjectKey = Record<string, AzureDeploymentOption[]>;

type LoadAzureProjectsOptions = {
  force?: boolean;
  preferredTenantId?: string;
  waitForWorkspaceStateReload?: boolean;
};

type LoadAzureDeploymentsOptions = {
  force?: boolean;
};

type LoadAzureProjectsResult = AzureProjectsLoadResult;

/**
 * Client runtime controller.
 * Owns interactive state for Playground/Threads/MCP/Settings and orchestrates server API calls.
 * This hook intentionally keeps state ownership centralized while delegating pure transforms
 * to modules under `~/lib/client/*`.
 */
export function useWorkspaceClientController() {
  // Primary runtime state for Client.
  const [azureConnections, setAzureConnections] = useState<AzureProjectOption[]>([]);
  const [azureTenants, setAzureTenants] = useState<AzureTenantOption[]>([]);
  const [playgroundAzureDeployments, setPlaygroundAzureDeployments] = useState<AzureDeploymentOption[]>(
    [],
  );
  const [utilityAzureDeployments, setUtilityAzureDeployments] = useState<AzureDeploymentOption[]>([]);
  const [activeAzurePrincipal, setActiveAzurePrincipal] = useState<AzurePrincipalProfile | null>(
    null,
  );
  const [draft, setDraft] = useState("");
  const [chatComposerCursorIndex, setChatComposerCursorIndex] = useState(0);
  const [chatCommandHighlightedIndex, setChatCommandHighlightedIndex] = useState(0);
  const [draftAttachments, setDraftAttachments] = useState<DraftChatAttachment[]>([]);
  const [chatAttachmentError, setChatAttachmentError] = useState<string | null>(null);
  const [activeMainTab, setActiveMainTab] = useState<MainViewTab>("threads");
  const [theme, setTheme] = useState<ThemeMode>(HOME_DEFAULT_THEME);
  const [selectedPlaygroundAzureConnectionId, setSelectedPlaygroundAzureConnectionId] = useState("");
  const [selectedPlaygroundAzureDeploymentName, setSelectedPlaygroundAzureDeploymentName] =
    useState("");
  const [selectedUtilityAzureConnectionId, setSelectedUtilityAzureConnectionId] = useState("");
  const [selectedUtilityAzureDeploymentName, setSelectedUtilityAzureDeploymentName] = useState("");
  const [isLoadingAzureConnections, setIsLoadingAzureConnections] = useState(false);
  const [isLoadingPlaygroundAzureDeployments, setIsLoadingPlaygroundAzureDeployments] =
    useState(false);
  const [isLoadingUtilityAzureDeployments, setIsLoadingUtilityAzureDeployments] = useState(false);
  const [azureProjectCatalogCacheByTenantId, setAzureProjectCatalogCacheByTenantId] =
    useState<AzureProjectCatalogCacheByTenantId>({});
  const [
    azureDeploymentCatalogCacheByTenantProjectKey,
    setAzureDeploymentCatalogCacheByTenantProjectKey,
  ] = useState<AzureDeploymentCatalogCacheByTenantProjectKey>({});
  const [azureConnectionError, setAzureConnectionError] = useState<string | null>(null);
  const [playgroundAzureDeploymentError, setPlaygroundAzureDeploymentError] =
    useState<string | null>(null);
  const [utilityAzureDeploymentError, setUtilityAzureDeploymentError] = useState<string | null>(
    null,
  );
  const [isAzureAuthRequired, setIsAzureAuthRequired] = useState(false);
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>(
    HOME_DEFAULT_REASONING_EFFORT,
  );
  const [webSearchEnabled, setWebSearchEnabled] = useState(HOME_DEFAULT_WEB_SEARCH_ENABLED);
  const [utilityReasoningEffort, setUtilityReasoningEffort] = useState<ReasoningEffort>(
    HOME_DEFAULT_UTILITY_REASONING_EFFORT,
  );
  const [agentInstruction, setAgentInstruction] = useState(DEFAULT_AGENT_INSTRUCTION);
  const [instructionContextToggles, setInstructionContextToggles] = useState(
    cloneThreadInstructionContexts(DEFAULT_THREAD_INSTRUCTION_CONTEXT_TOGGLES),
  );
  const [loadedInstructionFileName, setLoadedInstructionFileName] = useState<string | null>(null);
  const [instructionFileError, setInstructionFileError] = useState<string | null>(null);
  const [instructionSaveError, setInstructionSaveError] = useState<string | null>(null);
  const [instructionSaveSuccess, setInstructionSaveSuccess] = useState<string | null>(null);
  const [isSavingInstructionPrompt, setIsSavingInstructionPrompt] = useState(false);
  const [instructionEnhanceError, setInstructionEnhanceError] = useState<string | null>(null);
  const [instructionEnhanceSuccess, setInstructionEnhanceSuccess] = useState<string | null>(null);
  const [isEnhancingInstruction, setIsEnhancingInstruction] = useState(false);
  const [instructionEnhancingThreadId, setInstructionEnhancingThreadId] = useState("");
  const [instructionEnhanceComparison, setInstructionEnhanceComparison] =
    useState<InstructionEnhanceComparison | null>(null);
  const [workspaceMcpServerProfiles, setWorkspaceMcpServerProfiles] = useState<McpServerConfig[]>([]);
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
  const [mcpTransport, setMcpTransport] = useState<McpTransport>(HOME_DEFAULT_MCP_TRANSPORT);
  const [editingMcpServerId, setEditingMcpServerId] = useState("");
  const [mcpFormError, setMcpFormError] = useState<string | null>(null);
  const [mcpFormWarning, setMcpFormWarning] = useState<string | null>(null);
  const [workspaceMcpServerProfileError, setWorkspaceMcpServerProfileError] = useState<string | null>(null);
  const [isLoadingWorkspaceMcpServerProfiles, setIsLoadingWorkspaceMcpServerProfiles] = useState(false);
  const [isSavingMcpServer, setIsSavingMcpServer] = useState(false);
  const [isDeletingWorkspaceMcpServerProfile, setIsDeletingWorkspaceMcpServerProfile] = useState(false);
  const [threadRequestStateById, setThreadRequestStateById] = useState<
    Record<string, ThreadRequestState>
  >({});
  const [isComposing, setIsComposing] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);
  const [systemNotice, setSystemNotice] = useState<string | null>(null);
  const [isStartingAzureLogin, setIsStartingAzureLogin] = useState(false);
  const [isSwitchingAzureTenant, setIsSwitchingAzureTenant] = useState(false);
  const [isStartingAzureLogout, setIsStartingAzureLogout] = useState(false);
  const [isReloadingAzureCatalog, setIsReloadingAzureCatalog] = useState(false);
  const [azureLoginError, setAzureLoginError] = useState<string | null>(null);
  const [azureTenantSwitchError, setAzureTenantSwitchError] = useState<string | null>(null);
  const [azureLogoutError, setAzureLogoutError] = useState<string | null>(null);
  const [threads, setThreads] = useState<ThreadSnapshot[]>([]);
  const [activeThreadId, setActiveThreadId] = useState("");
  const [activeThreadNameInput, setActiveThreadNameInput] = useState("");
  const [isSavingThread, setIsSavingThread] = useState(false);
  const [threadOperationPhase, setThreadOperationPhase] = useState<ThreadOperationPhase>("idle");
  const [threadError, setThreadError] = useState<string | null>(null);
  const [availableSkills, setAvailableSkills] = useState<SkillCatalogEntry[]>([]);
  const [selectedMessageSkillActivations, setSelectedMessageSkillActivations] = useState<ThreadSkillActivation[]>([]);
  const [skillRegistryCatalogs, setSkillRegistryCatalogs] = useState<SkillRegistryCatalog[]>([]);
  const [isMutatingSkillRegistries, setIsMutatingSkillRegistries] = useState(false);
  const [skillRegistryError, setSkillRegistryError] = useState<string | null>(null);
  const [skillRegistryWarning, setSkillRegistryWarning] = useState<string | null>(null);
  const [skillRegistrySuccess, setSkillRegistrySuccess] = useState<string | null>(null);
  const [isLoadingSkills, setIsLoadingSkills] = useState(false);
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [skillsWarning, setSkillsWarning] = useState<string | null>(null);
  const [desktopUpdaterStatus, setDesktopUpdaterStatus] = useState(
    getDefaultDesktopUpdaterStatus,
  );
  const [isApplyingDesktopUpdate, setIsApplyingDesktopUpdate] = useState(false);
  const [rightPaneWidth, setRightPaneWidth] = useState(420);
  const [activeResizeHandle, setActiveResizeHandle] = useState<"main" | null>(null);
  const threadOperationPhaseFlags = selectThreadOperationPhaseFlags(threadOperationPhase);
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
  const azureConnectionsRequestSeqRef = useRef(0);
  const playgroundAzureDeploymentRequestSeqRef = useRef(0);
  const utilityAzureDeploymentRequestSeqRef = useRef(0);
  const activeAzureTenantIdRef = useRef("");
  const activeAzurePrincipalIdRef = useRef("");
  const activeWorkspaceUserKeyRef = useRef("");
  const workspaceMcpServerProfileLoginRetryTimeoutRef = useRef<number | null>(null);
  const workspaceMcpServerProfileRequestSeqRef = useRef(0);
  const skillsRequestSeqRef = useRef(0);
  const lastManualSkillsReloadAtRef = useRef(0);
  const previousIsAzureAuthRequiredRef = useRef(isAzureAuthRequired);
  const lastLoadedSkillsUserKeyRef = useRef("");
  const preferredAzureSelectionRef = useRef<AzureSelectionPreference | null>(null);
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
  const threadRequestStateByIdRef = useRef<Record<string, ThreadRequestState>>({});
  const threadSendAbortControllerByIdRef = useRef(new Map<string, AbortController>());
  const workspaceMcpServerProfilesRef = useRef<McpServerConfig[]>([]);
  const threadsRef = useRef<ThreadSnapshot[]>([]);

  // Derived UI state and view models consumed by panel props.
  const isChatLocked = isAzureAuthRequired;
  const activePlaygroundAzureConnection =
    azureConnections.find((connection) => connection.id === selectedPlaygroundAzureConnectionId) ??
    azureConnections[0] ??
    null;
  const activeUtilityAzureConnection =
    azureConnections.find((connection) => connection.id === selectedUtilityAzureConnectionId) ??
    azureConnections[0] ??
    null;
  const instructionRuntimeUiState = deriveInstructionRuntimeUiState({
    agentInstruction,
    loadedInstructionFileName,
    instructionFileError,
  });
  const canClearAgentInstruction = instructionRuntimeUiState.hasInstructionInteraction;
  const canSaveAgentInstructionPrompt = instructionRuntimeUiState.canSaveAgentInstructionPrompt;
  const canEnhanceAgentInstruction = instructionRuntimeUiState.canEnhanceAgentInstruction;
  const playgroundAzureDeploymentNames = playgroundAzureDeployments.map(
    (deployment) => deployment.name,
  );
  const utilityAzureDeploymentNames = utilityAzureDeployments.map((deployment) => deployment.name);
  const selectedPlaygroundAzureDeployment = playgroundAzureDeployments.find(
    (deployment) => deployment.name === selectedPlaygroundAzureDeploymentName,
  );
  const selectedUtilityAzureDeployment = utilityAzureDeployments.find(
    (deployment) => deployment.name === selectedUtilityAzureDeploymentName,
  );
  const selectedPlaygroundDeploymentReasoningEffortOptions = resolveSupportedReasoningEffortOptions(
    selectedPlaygroundAzureDeployment?.reasoningEffortOptions ?? [],
  );
  const selectedUtilityDeploymentReasoningEffortOptions = resolveSupportedReasoningEffortOptions(
    selectedUtilityAzureDeployment?.reasoningEffortOptions ?? [],
  );
  const selectedPlaygroundDeploymentCompatibleReasoningEffortOptions =
    filterReasoningEffortOptionsForDeploymentCompatibility(
      selectedPlaygroundDeploymentReasoningEffortOptions,
      selectedPlaygroundAzureDeploymentName,
    );
  const selectedUtilityDeploymentCompatibleReasoningEffortOptions =
    filterReasoningEffortOptionsForDeploymentCompatibility(
      selectedUtilityDeploymentReasoningEffortOptions,
      selectedUtilityAzureDeploymentName,
    );
  const isPlaygroundReasoningEffortSupported =
    selectedPlaygroundDeploymentCompatibleReasoningEffortOptions.length > 0;
  const isUtilityReasoningEffortSupported =
    selectedUtilityDeploymentCompatibleReasoningEffortOptions.length > 0;
  const effectivePlaygroundReasoningEffortOptions: ReasoningEffort[] = isPlaygroundReasoningEffortSupported
    ? filterReasoningEffortOptionsForWebSearch(
        selectedPlaygroundDeploymentCompatibleReasoningEffortOptions,
        webSearchEnabled,
      )
    : [HOME_DEFAULT_REASONING_EFFORT];
  const effectiveUtilityReasoningEffortOptions: ReasoningEffort[] = isUtilityReasoningEffortSupported
    ? selectedUtilityDeploymentCompatibleReasoningEffortOptions
    : [HOME_DEFAULT_REASONING_EFFORT];
  const effectiveUtilityReasoningEffort = resolveEffectiveReasoningEffort(
    utilityReasoningEffort,
    effectiveUtilityReasoningEffortOptions,
    HOME_DEFAULT_UTILITY_REASONING_EFFORT,
  );
  const isSelectedPlaygroundReasoningEffortOptionAvailable =
    !isPlaygroundReasoningEffortSupported ||
    effectivePlaygroundReasoningEffortOptions.includes(reasoningEffort);
  const isPlaygroundReasoningEffortWebSearchCompatible =
    !webSearchEnabled ||
    !isPlaygroundReasoningEffortSupported ||
    isWebSearchCompatibleReasoningEffort(reasoningEffort);
  const activeThreadRequestState =
    threadRequestStateById[activeThreadId] ?? HOME_DEFAULT_THREAD_REQUEST_STATE;
  const isSending = activeThreadRequestState.isSending;
  const sendProgressMessages = activeThreadRequestState.sendProgressMessages;
  const activeTurnId = activeThreadRequestState.activeTurnId;
  const lastErrorTurnId = activeThreadRequestState.lastErrorTurnId;
  const error = uiError ?? activeThreadRequestState.error;
  const activeThreadRuntimeState = useMemo(
    () => readThreadRuntimeStateById(threads, activeThreadId),
    [activeThreadId, threads],
  );
  const activeThreadSnapshot = activeThreadRuntimeState.activeThreadSnapshot;
  const messages =
    activeThreadSnapshot !== null ? activeThreadRuntimeState.messages : [...HOME_INITIAL_MESSAGES];
  const mcpServers = activeThreadRuntimeState.mcpServers;
  const mcpRpcLogs = activeThreadRuntimeState.mcpRpcLogs;
  const selectedThreadSkills = activeThreadRuntimeState.skillSelections;
  const threadOperationLogsByTurnId = useMemo(
    () => buildThreadOperationLogsByTurnId(mcpRpcLogs),
    [mcpRpcLogs],
  );
  const activeTurnOperationLogs = useMemo(
    () => (activeTurnId ? (threadOperationLogsByTurnId.get(activeTurnId) ?? []) : []),
    [activeTurnId, threadOperationLogsByTurnId],
  );
  const errorTurnOperationLogs = useMemo(
    () => (lastErrorTurnId ? (threadOperationLogsByTurnId.get(lastErrorTurnId) ?? []) : []),
    [lastErrorTurnId, threadOperationLogsByTurnId],
  );
  const workspaceMcpServerProfileOptions = useMemo(
    () => buildWorkspaceMcpServerProfileOptions(workspaceMcpServerProfiles, mcpServers),
    [workspaceMcpServerProfiles, mcpServers],
  );
  const editingMcpServer =
    editingMcpServerId.trim().length > 0
      ? workspaceMcpServerProfiles.find((server) => server.id === editingMcpServerId) ?? null
      : null;
  const isEditingMcpServer = editingMcpServer !== null;
  const editingMcpServerName = editingMcpServer?.name ?? null;
  const isMutatingWorkspaceMcpServerProfiles = isSavingMcpServer || isDeletingWorkspaceMcpServerProfile;
  const selectedWorkspaceMcpServerProfileCount = useMemo(
    () => countSelectedWorkspaceMcpServerProfileOptions(workspaceMcpServerProfileOptions),
    [workspaceMcpServerProfileOptions],
  );
  const draftAttachmentTotalSizeBytes = draftAttachments.reduce(
    (sum, attachment) => sum + attachment.sizeBytes,
    0,
  );
  const draftPdfAttachmentTotalSizeBytes = draftAttachments.reduce(
    (sum, attachment) =>
      sum + (getFileExtension(attachment.name) === "pdf" ? attachment.sizeBytes : 0),
    0,
  );
  const chatAttachmentAccept = [
    ...Array.from(CHAT_ATTACHMENT_ALLOWED_EXTENSIONS, (extension) => `.${extension}`),
  ].join(",");
  const chatAttachmentFormatHint = "Code Interpreter supported files (.pdf, .csv, .xlsx, .docx, .png, ...)";
  const threadSummaries: ThreadSummary[] = threads.map((thread) => buildThreadSummary(thread));
  const isActiveThreadArchived = isThreadSnapshotArchived(activeThreadSnapshot);
  const isEnhancingInstructionForActiveThread =
    isEnhancingInstruction &&
    instructionEnhancingThreadId.length > 0 &&
    instructionEnhancingThreadId === activeThreadId;
  const activeThreadSummaries = threadSummaries.filter((thread) => thread.deletedAt === null);
  const archivedThreadSummaries = threadSummaries.filter((thread) => thread.deletedAt !== null);
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
    () => new Map(availableSkills.map((skill) => [skill.location, skill] as const)),
    [availableSkills],
  );
  const threadSkillOptions = useMemo(() => {
    const selectedThreadSkillLocationSet = new Set(
      selectedThreadSkills.map((selection) => selection.location),
    );
    return [
      ...availableSkills.map((skill) => ({
        name: skill.name,
        description: skill.description,
        location: skill.location,
        source: skill.source,
        badge: resolveSkillBadgeLabel(skill.source, skill.location),
        isSelected: selectedThreadSkillLocationSet.has(skill.location),
        isAvailable: true,
      })),
      ...selectedThreadSkills
        .filter((selection) => !availableSkillByLocation.has(selection.location))
        .map((selection) => ({
          name: selection.name,
          description: "Saved for this thread, but the SKILL.md file is currently unavailable.",
          location: selection.location,
          source: "app_data" as const,
          badge: resolveSkillBadgeLabel("app_data", selection.location),
          isSelected: true,
          isAvailable: false,
        })),
    ].sort((left, right) => {
      if (left.isSelected !== right.isSelected) {
        return left.isSelected ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    });
  }, [availableSkillByLocation, availableSkills, selectedThreadSkills]);
  const messageSkillActivationOptions = useMemo(() => {
    const selectedMessageSkillActivationLocationSet = new Set(
      selectedMessageSkillActivations.map((selection) => selection.location),
    );
    return [
      ...availableSkills.map((skill) => ({
        name: skill.name,
        description: skill.description,
        location: skill.location,
        source: skill.source,
        badge: resolveSkillBadgeLabel(skill.source, skill.location),
        isSelected: selectedMessageSkillActivationLocationSet.has(skill.location),
        isAvailable: true,
      })),
      ...selectedMessageSkillActivations
        .filter((selection) => !availableSkillByLocation.has(selection.location))
        .map((selection) => ({
          name: selection.name,
          description:
            "Added for this message, but the SKILL.md file is currently unavailable.",
          location: selection.location,
          source: "app_data" as const,
          badge: resolveSkillBadgeLabel("app_data", selection.location),
          isSelected: true,
          isAvailable: false,
        })),
    ].sort((left, right) => {
      if (left.isSelected !== right.isSelected) {
        return left.isSelected ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    });
  }, [availableSkillByLocation, availableSkills, selectedMessageSkillActivations]);
  const chatCommandProviders: ChatCommandProvider[] = [
    {
      keyword: "$",
      emptyHint: "No matching Skills.",
      readSuggestions: (query) => readSkillCommandSuggestions(messageSkillActivationOptions, query),
      applySuggestion: (suggestion) => {
        if (!suggestion.isAvailable) {
          return;
        }

        handleAddMessageSkillActivation(suggestion.id);
      },
    },
  ];
  const chatCommandKeywords = chatCommandProviders.map((provider) => provider.keyword);
  const effectiveChatComposerCursorIndex =
    chatInputRef.current?.selectionStart ?? chatComposerCursorIndex;
  const activeChatCommandMatch = readChatCommandMatchAtCursor({
    value: draft,
    cursorIndex: effectiveChatComposerCursorIndex,
    keywords: chatCommandKeywords,
  });
  const activeChatCommandProvider = activeChatCommandMatch
    ? (chatCommandProviders.find((provider) => provider.keyword === activeChatCommandMatch.keyword) ??
      null)
    : null;
  const activeChatCommandSuggestions =
    activeChatCommandMatch && activeChatCommandProvider
      ? activeChatCommandProvider.readSuggestions(activeChatCommandMatch.query)
      : [];
  const activeChatCommandHighlightIndex =
    activeChatCommandSuggestions.length > 0
      ? clampNumber(chatCommandHighlightedIndex, 0, activeChatCommandSuggestions.length - 1)
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
  const skillRegistryGroups = useMemo(() => {
    if (skillRegistryCatalogs.length > 0) {
      return skillRegistryCatalogs.map((registry) => ({
        registryUrl:
          readSkillRegistryOptionById(registry.registryId)?.sourceUrl ??
          registry.repositoryUrl,
        registryId: registry.registryId,
        label: registry.registryLabel,
        description: registry.registryDescription,
        skillCount: registry.skills.length,
        installedCount: registry.skills.filter((skill) => skill.isInstalled).length,
        skills: [...registry.skills]
          .sort((left, right) => {
            if (left.isInstalled !== right.isInstalled) {
              return left.isInstalled ? -1 : 1;
            }

            const byTag = (left.tag ?? "").localeCompare(right.tag ?? "");
            if (byTag !== 0) {
              return byTag;
            }

            return left.name.localeCompare(right.name);
          })
          .map((skill) => ({
            id: skill.id,
            name: skill.name,
            description: skill.description,
            detail: skill.isInstalled
              ? `${skill.tag ? `Tag: ${skill.tag} · ` : ""}${
                  skill.isUpdateAvailable ? "Update available · " : ""
                }Installed: ${skill.installLocation}`
              : `${skill.tag ? `Tag: ${skill.tag} · ` : ""}Source: ${skill.remotePath}`,
            isInstalled: skill.isInstalled,
            isUpdateAvailable: skill.isUpdateAvailable,
          })),
      }));
    }

    return SKILL_REGISTRY_OPTIONS.map((registry) => ({
      registryUrl: registry.sourceUrl,
      registryId: registry.id,
      label: registry.label,
      description: registry.description,
      skillCount: 0,
      installedCount: 0,
      skills: [],
    }));
  }, [skillRegistryCatalogs]);
  const canSendMessage = canSendMessageByGuard({
    threadOperationPhase,
    isSending,
    isActiveThreadArchived,
    isChatLocked,
    isLoadingAzureConnections,
    isLoadingPlaygroundAzureDeployments,
    hasActiveThreadId: activeThreadId.trim().length > 0,
    hasActivePlaygroundAzureConnection: !!activePlaygroundAzureConnection,
    hasSelectedPlaygroundAzureDeploymentName: selectedPlaygroundAzureDeploymentName.trim().length > 0,
    isSelectedPlaygroundReasoningEffortOptionAvailable,
    isPlaygroundReasoningEffortWebSearchCompatible,
    hasDraftContent: draft.trim().length > 0,
  });

  // Observability helpers for Client runtime events.
  function buildRuntimeLogContext(extra: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      activeMainTab: activeMainTabRef.current,
      activeThreadId: activeThreadIdRef.current,
      selectedPlaygroundAzureConnectionId: selectedPlaygroundAzureConnectionIdRef.current,
      selectedPlaygroundAzureDeploymentName: selectedPlaygroundAzureDeploymentNameRef.current,
      selectedUtilityAzureConnectionId: selectedUtilityAzureConnectionIdRef.current,
      selectedUtilityAzureDeploymentName: selectedUtilityAzureDeploymentNameRef.current,
      tenantId: activeAzureTenantIdRef.current,
      principalId: activeAzurePrincipalIdRef.current,
      ...extra,
    };
  }

  function logHomeError(
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
      location: options.location ?? "home",
      action: options.action,
      ...(options.statusCode !== undefined ? { statusCode: options.statusCode } : {}),
      threadId: activeThreadIdRef.current || undefined,
      context: buildRuntimeLogContext(options.context),
    });
  }

  function logHomeWarning(
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
      location: options.location ?? "home",
      action: options.action,
      threadId: activeThreadIdRef.current || undefined,
      context: buildRuntimeLogContext(options.context),
    });
  }

  function logHomeInfo(
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
      location: options.location ?? "home",
      ...(options.action ? { action: options.action } : {}),
      ...(activeThreadIdRef.current ? { threadId: activeThreadIdRef.current } : {}),
      context: buildRuntimeLogContext(options.context),
    });
  }

  // Keep refs synchronized with state to avoid stale closures in async handlers.
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = theme;
    }
  }, [theme]);

  useEffect(() => {
    activeMainTabRef.current = activeMainTab;
  }, [activeMainTab]);

  useEffect(() => {
    selectedPlaygroundAzureConnectionIdRef.current = selectedPlaygroundAzureConnectionId;
  }, [selectedPlaygroundAzureConnectionId]);

  useEffect(() => {
    selectedPlaygroundAzureDeploymentNameRef.current = selectedPlaygroundAzureDeploymentName;
  }, [selectedPlaygroundAzureDeploymentName]);

  useEffect(() => {
    selectedUtilityAzureConnectionIdRef.current = selectedUtilityAzureConnectionId;
  }, [selectedUtilityAzureConnectionId]);

  useEffect(() => {
    selectedUtilityAzureDeploymentNameRef.current = selectedUtilityAzureDeploymentName;
  }, [selectedUtilityAzureDeploymentName]);

  useEffect(() => {
    return installGlobalClientErrorLogging(() =>
      buildRuntimeLogContext({
        source: "home",
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
        logHomeWarning(
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

    resizeChatInput(input);
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
    void loadAzureProjects();
  }, []);

  useEffect(() => {
    void loadAvailableSkills();
  }, []);

  useEffect(() => {
    if (!isAzureAuthRequired) {
      return;
    }

    const refreshConnections = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }

      void (async () => {
        const loadResult = await loadAzureProjects();
        if (isAzureProjectsLoadReady(loadResult)) {
          setAzureLoginError(null);
          setUiError(null);
        }
      })();
    };

    const intervalId = window.setInterval(refreshConnections, 4000);
    window.addEventListener("focus", refreshConnections);
    document.addEventListener("visibilitychange", refreshConnections);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshConnections);
      document.removeEventListener("visibilitychange", refreshConnections);
    };
  }, [isAzureAuthRequired]);

  useEffect(() => {
    const wasAzureAuthRequired = previousIsAzureAuthRequiredRef.current;
    previousIsAzureAuthRequiredRef.current = isAzureAuthRequired;

    const tenantId = activeAzurePrincipal?.tenantId.trim() ?? "";
    const principalId = activeAzurePrincipal?.principalId.trim() ?? "";
    const activeUserKey =
      !isAzureAuthRequired && tenantId && principalId ? `${tenantId}::${principalId}` : "";

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
    if (!shouldReloadForIdentityChange && !wasAzureAuthRequired && !hasAuthRequiredSkillsError) {
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
    if (!activePlaygroundAzureConnection) {
      cancelAzureDeploymentLoad("playground");
      setPlaygroundAzureDeployments([]);
      setSelectedPlaygroundAzureDeploymentName("");
      setPlaygroundAzureDeploymentError(null);
      return;
    }

    void loadAzureDeployments(activePlaygroundAzureConnection.id, "playground", { force: true });
  }, [activePlaygroundAzureConnection]);

  useEffect(() => {
    if (!activeUtilityAzureConnection) {
      cancelAzureDeploymentLoad("utility");
      setUtilityAzureDeployments([]);
      setSelectedUtilityAzureDeploymentName("");
      setUtilityAzureDeploymentError(null);
      return;
    }

    void loadAzureDeployments(activeUtilityAzureConnection.id, "utility", { force: true });
  }, [activeUtilityAzureConnection]);

  useEffect(() => {
    if (isAzureAuthRequired) {
      return;
    }

    const tenantId = activeAzureTenantIdRef.current.trim();
    const principalId = activeAzurePrincipalIdRef.current.trim();
    const projectId = selectedPlaygroundAzureConnectionId.trim();
    const deploymentName = selectedPlaygroundAzureDeploymentName.trim();
    if (!tenantId || !principalId || !projectId || !deploymentName) {
      return;
    }

    if (!azureConnections.some((connection) => connection.id === projectId)) {
      return;
    }

    if (!includesAzureDeploymentName(playgroundAzureDeployments, deploymentName)) {
      return;
    }

    const preferred = preferredAzureSelectionRef.current;
    if (
      preferred &&
      preferred.tenantId === tenantId &&
      preferred.principalId === principalId &&
      preferred.playground?.projectId === projectId &&
      preferred.playground?.deploymentName === deploymentName
    ) {
      return;
    }

    void saveAzureSelectionPreference({
      target: "playground",
      tenantId,
      principalId,
      projectId,
      deploymentName,
    });
  }, [
    azureConnections,
    playgroundAzureDeployments,
    isAzureAuthRequired,
    selectedPlaygroundAzureConnectionId,
    selectedPlaygroundAzureDeploymentName,
  ]);

  useEffect(() => {
    if (isAzureAuthRequired) {
      return;
    }

    const tenantId = activeAzureTenantIdRef.current.trim();
    const principalId = activeAzurePrincipalIdRef.current.trim();
    const projectId = selectedUtilityAzureConnectionId.trim();
    const deploymentName = selectedUtilityAzureDeploymentName.trim();
    const nextUtilityReasoningEffort = effectiveUtilityReasoningEffort;
    if (!tenantId || !principalId || !projectId || !deploymentName) {
      return;
    }

    if (!azureConnections.some((connection) => connection.id === projectId)) {
      return;
    }

    if (!includesAzureDeploymentName(utilityAzureDeployments, deploymentName)) {
      return;
    }

    const preferred = preferredAzureSelectionRef.current;
    if (
      preferred &&
      preferred.tenantId === tenantId &&
      preferred.principalId === principalId &&
      preferred.utility?.projectId === projectId &&
      preferred.utility?.deploymentName === deploymentName &&
      preferred.utility?.reasoningEffort === nextUtilityReasoningEffort
    ) {
      return;
    }

    void saveAzureSelectionPreference({
      target: "utility",
      tenantId,
      principalId,
      projectId,
      deploymentName,
      reasoningEffort: nextUtilityReasoningEffort,
    });
  }, [
    azureConnections,
    utilityAzureDeployments,
    isAzureAuthRequired,
    selectedUtilityAzureConnectionId,
    selectedUtilityAzureDeploymentName,
    effectiveUtilityReasoningEffort,
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
          clampNumber(current, HOME_MAIN_SPLITTER_MIN_RIGHT_WIDTH_PX, maxRightWidth),
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
    return () => {
      clearWorkspaceMcpServerProfileLoginRetryTimeout();
    };
  }, []);

  useEffect(() => {
    if (!editingMcpServerId) {
      return;
    }

    const targetExists = workspaceMcpServerProfiles.some((server) => server.id === editingMcpServerId);
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

    const baseThread = findThreadSnapshotById(threadsRef.current, currentThreadId);
    if (!baseThread) {
      return;
    }

    const snapshot = buildThreadSnapshotFromCurrentState(baseThread);
    if (!shouldPersistThreadSnapshot(snapshot)) {
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
      void saveThreadSnapshotToDatabase(snapshot, signature);
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

    const baseThread = findThreadSnapshotById(threadsRef.current, currentThreadId);
    if (!baseThread) {
      return;
    }
    if (!shouldPersistThreadSnapshot(baseThread)) {
      return;
    }

    const trimmedName = activeThreadNameInput.trim().slice(0, HOME_THREAD_NAME_MAX_LENGTH);
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

    const baseThread = findThreadSnapshotById(threadsRef.current, currentThreadId);
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
  }, [
    activeThreadId,
    agentInstruction,
    threads,
    threadOperationPhase,
  ]);

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
    if (!deploymentName || !includesAzureDeploymentName(utilityAzureDeployments, deploymentName)) {
      return;
    }

    const currentThreadId = activeThreadIdRef.current.trim();
    if (!currentThreadId || isArchivedThread(currentThreadId)) {
      return;
    }

    const baseThread = findThreadSnapshotById(threadsRef.current, currentThreadId);
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
      const { payload } = await requestClientApi<McpServersApiResponse>({
        url: "/api/mcp/servers",
        init: {
          method: "GET",
        },
        readPayload: (response) => readJsonPayload<McpServersApiResponse>(response, "saved MCP servers"),
        resolveAuthRequired: (status, responsePayload) =>
          resolveAuthRequired(status, responsePayload, (rawPayload) =>
            isMcpServersAuthRequired(status, rawPayload as McpServersApiResponse),
          ),
        readErrorMessage: (responsePayload) =>
          typeof responsePayload.error === "string" ? responsePayload.error : null,
        fallbackErrorMessage: "Failed to load saved MCP servers.",
        authRequiredMessage: "Azure login is required. Open Settings and sign in to load MCP servers.",
        onAuthRequired: () => {
          setIsAzureAuthRequired(true);
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

      const parsedServers = readMcpServerList(payload.profiles);
      workspaceMcpServerProfilesRef.current = parsedServers;
      setWorkspaceMcpServerProfiles(parsedServers);
      setWorkspaceMcpServerProfileError(null);
    } catch (loadError) {
      if (requestSeq !== workspaceMcpServerProfileRequestSeqRef.current) {
        return;
      }
      if (expectedUserKey !== activeWorkspaceUserKeyRef.current.trim()) {
        return;
      }
      if (loadError instanceof ClientApiError && loadError.kind === "auth_required") {
        return;
      }
      logHomeError("load_saved_mcp_servers_failed", loadError, {
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

  async function loadAvailableSkills(options: {
    clearStatus?: boolean;
    forceRefresh?: boolean;
  } = {}): Promise<void> {
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
      const skillsRequestUrl =
        options.forceRefresh === true ? "/api/skills?refresh=1" : "/api/skills";
      const { payload } = await requestClientApi<SkillsApiResponse>({
        url: skillsRequestUrl,
        init: {
          method: "GET",
        },
        readPayload: (response) => readJsonPayload<SkillsApiResponse>(response, "Skills"),
        resolveAuthRequired: (status, responsePayload) =>
          resolveAuthRequired(status, responsePayload),
        readErrorMessage: (responsePayload) =>
          typeof responsePayload.error === "string" ? responsePayload.error : null,
        fallbackErrorMessage: "Failed to load Skills.",
        authRequiredMessage: "Azure login is required. Open Settings and sign in to load Skills.",
        onAuthRequired: () => {
          setIsAzureAuthRequired(true);
          setAvailableSkills([]);
          setSkillRegistryCatalogs([]);
          setSkillsError("Azure login is required. Open Settings and sign in to load Skills.");
          setSkillRegistryError("Azure login is required. Open Settings and sign in to load Skills.");
        },
      });
      if (requestSeq !== skillsRequestSeqRef.current) {
        return;
      }
      if (expectedUserKey !== activeWorkspaceUserKeyRef.current.trim()) {
        return;
      }

      setIsAzureAuthRequired((currentAuthRequired) =>
        resolveAzureAuthRequiredState({
          currentAuthRequired,
          nextAuthRequired: false,
          source: "background_success",
        }),
      );
      applySkillsApiPayload(payload);
      setSkillRegistrySuccess(null);
    } catch (loadError) {
      if (requestSeq !== skillsRequestSeqRef.current) {
        return;
      }
      if (expectedUserKey !== activeWorkspaceUserKeyRef.current.trim()) {
        return;
      }
      if (loadError instanceof ClientApiError && loadError.kind === "auth_required") {
        return;
      }

      logHomeError("load_skills_failed", loadError, {
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
    const parsedRegistryCatalogs = readSkillRegistryCatalogList(payload.registries);
    const skillWarnings = readStringList(payload.skillWarnings);
    const registryWarnings = readStringList(payload.registryWarnings);

    setAvailableSkills(parsedSkills);
    setSkillRegistryCatalogs(parsedRegistryCatalogs);
    setSkillsError(null);
    setSkillRegistryError(null);
    setSkillsWarning(skillWarnings.length > 0 ? skillWarnings.slice(0, 2).join("\n") : null);
    setSkillRegistryWarning(
      registryWarnings.length > 0 ? registryWarnings.slice(0, 2).join("\n") : null,
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
      const mutationMethod = options.action === "install_registry_skill" ? "PUT" : "DELETE";
      const { payload } = await requestClientApi<SkillsApiResponse>({
        url: buildSkillRegistrySkillApiPath(options),
        init: {
          method: mutationMethod,
        },
        readPayload: (response) => readJsonPayload<SkillsApiResponse>(response, "Skills"),
        resolveAuthRequired: (status, responsePayload) =>
          resolveAuthRequired(status, responsePayload),
        readErrorMessage: (responsePayload) =>
          typeof responsePayload.error === "string" ? responsePayload.error : null,
        fallbackErrorMessage: "Failed to update Skill registry.",
        authRequiredMessage:
          "Azure login is required. Open Settings and sign in to update Skill registries.",
        onAuthRequired: () => {
          setIsAzureAuthRequired(true);
        },
      });

      setIsAzureAuthRequired((currentAuthRequired) =>
        resolveAzureAuthRequiredState({
          currentAuthRequired,
          nextAuthRequired: false,
          source: "background_success",
        }),
      );
      applySkillsApiPayload(payload);
      const message = typeof payload.message === "string" ? payload.message.trim() : "";
      setSkillRegistrySuccess(message || null);
    } catch (error) {
      if (error instanceof ClientApiError && error.kind === "auth_required") {
        setSkillRegistryError(error.message);
        return;
      }
      logHomeError("update_skill_registry_failed", error, {
        action: options.action,
        context: {
          registryId: options.registryId,
          skillName: options.skillName,
        },
      });
      setSkillRegistryError(mapApiError(error, "Failed to update Skill registry."));
    } finally {
      setIsMutatingSkillRegistries(false);
    }
  }

  function buildSkillRegistrySkillApiPath(options: {
    registryId: SkillRegistryId;
    skillName: string;
  }): string {
    const encodedSkillPath = options.skillName
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    return `/api/skills/registries/${encodeURIComponent(options.registryId)}/skills/${encodedSkillPath}`;
  }

  // Timer and reset helpers.
  function clearWorkspaceMcpServerProfileLoginRetryTimeout() {
    const timeoutId = workspaceMcpServerProfileLoginRetryTimeoutRef.current;
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
      workspaceMcpServerProfileLoginRetryTimeoutRef.current = null;
    }
  }

  function scheduleWorkspaceMcpServerProfileLoginRetry(expectedUserKey: string) {
    clearWorkspaceMcpServerProfileLoginRetryTimeout();
    workspaceMcpServerProfileLoginRetryTimeoutRef.current = window.setTimeout(() => {
      workspaceMcpServerProfileLoginRetryTimeoutRef.current = null;
      if (activeWorkspaceUserKeyRef.current === expectedUserKey) {
        void loadWorkspaceMcpServerProfiles();
      }
    }, 1200);
  }

  function clearWorkspaceMcpServerProfilesState(nextError: string | null = null) {
    clearWorkspaceMcpServerProfileLoginRetryTimeout();
    setEditingMcpServerId("");
    setIsDeletingWorkspaceMcpServerProfile(false);
    workspaceMcpServerProfilesRef.current = [];
    setWorkspaceMcpServerProfiles([]);
    setWorkspaceMcpServerProfileError(nextError);
    setIsLoadingWorkspaceMcpServerProfiles(false);
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
    setMcpTransport(HOME_DEFAULT_MCP_TRANSPORT);
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
      setMcpArgsInput(server.args.length > 0 ? JSON.stringify(server.args) : "");
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

  function setThreadsState(nextThreads: ThreadSnapshot[]): void {
    threadsRef.current = nextThreads;
    setThreads(nextThreads);
  }

  function updateThreadsState(
    updater: (current: ThreadSnapshot[]) => ThreadSnapshot[],
  ): ThreadSnapshot[] {
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
    setReasoningEffort(HOME_DEFAULT_REASONING_EFFORT);
    setWebSearchEnabled(HOME_DEFAULT_WEB_SEARCH_ENABLED);
    setAgentInstruction(DEFAULT_AGENT_INSTRUCTION);
    setInstructionContextToggles(
      cloneThreadInstructionContexts(DEFAULT_THREAD_INSTRUCTION_CONTEXT_TOGGLES),
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
    setThreadRequestStateById({});
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

    setThreadOperationPhase((current) =>
      transitionThreadOperation(current, {
        type: "start",
        phase,
      }).to,
    );
    return true;
  }

  function resetThreadOperationPhase(): void {
    setThreadOperationPhase((current) =>
      transitionThreadOperation(current, {
        type: "reset",
      }).to,
    );
  }

  function endThreadOperation(expectedPhase: Exclude<ThreadOperationPhase, "idle">): void {
    setThreadOperationPhase((current) =>
      transitionThreadOperation(current, {
        type: "complete",
        phase: expectedPhase,
      }).to,
    );
  }

  // Thread request-state helpers.
  function readThreadRequestState(threadId: string): ThreadRequestState {
    if (!threadId) {
      return HOME_DEFAULT_THREAD_REQUEST_STATE;
    }

    return threadRequestStateByIdRef.current[threadId] ?? HOME_DEFAULT_THREAD_REQUEST_STATE;
  }

  function updateThreadRequestState(
    threadId: string,
    updater: (current: ThreadRequestState) => ThreadRequestState,
  ): void {
    if (!threadId) {
      return;
    }

    setThreadRequestStateById((current) => {
      const base = current[threadId] ?? HOME_DEFAULT_THREAD_REQUEST_STATE;
      const next = updater(base);
      return {
        ...current,
        [threadId]: next,
      };
    });
  }

  function assignThreadSendAbortController(threadId: string, abortController: AbortController): void {
    const normalizedThreadId = threadId.trim();
    if (!normalizedThreadId) {
      return;
    }

    threadSendAbortControllerByIdRef.current.set(normalizedThreadId, abortController);
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
      const current = threadSendAbortControllerByIdRef.current.get(normalizedThreadId);
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

    const abortController = threadSendAbortControllerByIdRef.current.get(threadId);
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

  function appendThreadProgressMessage(threadId: string, message: string): void {
    const trimmed = message.trim();
    if (!threadId || !trimmed) {
      return;
    }

    updateThreadRequestState(threadId, (current) => {
      if (current.sendProgressMessages[current.sendProgressMessages.length - 1] === trimmed) {
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

  function resolveThreadNameForSave(baseName: string, includeDraftName: boolean): string {
    if (!includeDraftName) {
      return baseName;
    }

    const draftName = activeThreadNameInput.trim();
    if (!draftName) {
      return baseName;
    }

    return draftName.slice(0, HOME_THREAD_NAME_MAX_LENGTH);
  }

  function shouldPersistThreadSnapshot(
    snapshot: Pick<
      ThreadSnapshot,
      | "id"
      | "messages"
      | "reasoningEffort"
      | "webSearchEnabled"
      | "instructionContextToggles"
      | "threadEnvironment"
    > &
      Partial<Pick<ThreadSnapshot, "skillSelections">>,
  ): boolean {
    if (hasThreadPersistableState(snapshot)) {
      return true;
    }

    return threadSaveSignatureByIdRef.current.has(snapshot.id);
  }

  function createLocalThreadSnapshot(options: {
    name?: string;
  } = {}): ThreadSnapshot {
    const now = new Date().toISOString();
    const normalizedName = (options.name ?? "").trim().slice(0, HOME_THREAD_NAME_MAX_LENGTH);
    const name = normalizedName || THREAD_DEFAULT_NAME;
    const defaultThreadMcpServers = workspaceMcpServerProfilesRef.current.filter(
      (server) => server.connectOnThreadCreate === true,
    );

    return {
      id: createId("thread"),
      name,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      reasoningEffort: HOME_DEFAULT_REASONING_EFFORT,
      webSearchEnabled: HOME_DEFAULT_WEB_SEARCH_ENABLED,
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

  function buildThreadSnapshotFromCurrentState(
    base: ThreadSnapshot,
    options: {
      includeDraftName?: boolean;
    } = {},
  ): ThreadSnapshot {
    const includeDraftName = options.includeDraftName === true;
    return {
      ...base,
      name: resolveThreadNameForSave(base.name, includeDraftName),
      updatedAt: new Date().toISOString(),
      reasoningEffort,
      webSearchEnabled,
      agentInstruction,
      instructionContextToggles: cloneThreadInstructionContexts(instructionContextToggles),
      threadEnvironment: cloneThreadEnvironment(base.threadEnvironment),
      messages: cloneMessages(messages),
      mcpServers: cloneMcpServers(mcpServers),
      mcpRpcLogs: cloneThreadOperationLogs(mcpRpcLogs),
      skillSelections: cloneThreadSkillActivations(selectedThreadSkills),
    };
  }

  function setThreadSaveSignatures(nextThreads: ThreadSnapshot[]) {
    const signatureMap = threadSaveSignatureByIdRef.current;
    signatureMap.clear();
    for (const thread of nextThreads) {
      signatureMap.set(thread.id, buildThreadSaveSignature(thread));
    }
  }

  function updateThreadSnapshotById(
    threadId: string,
    updater: (current: ThreadSnapshot) => ThreadSnapshot,
  ): void {
    if (!threadId) {
      return;
    }

    updateThreadsState((current) =>
      updateThreadSnapshotCollectionById(current, threadId, updater),
    );
  }

  function appendMessageToThreadState(threadId: string, message: ThreadMessage): void {
    const clonedMessage: ThreadMessage = {
      ...message,
      attachments: message.attachments.map((attachment) => ({ ...attachment })),
      skillActivations: message.skillActivations.map((selection) => ({ ...selection })),
    };

    updateThreadSnapshotById(threadId, (thread) => ({
      ...thread,
      updatedAt: new Date().toISOString(),
      messages: [...thread.messages, clonedMessage],
    }));
  }

  function appendThreadOperationLogToThreadState(threadId: string, entry: ThreadOperationLogEntry): void {
    const clonedEntry: ThreadOperationLogEntry = { ...entry };

    updateThreadSnapshotById(threadId, (thread) => ({
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
    updateThreadSnapshotById(threadId, (thread) => ({
      ...thread,
      updatedAt: new Date().toISOString(),
      threadEnvironment: cloneThreadEnvironment(nextEnvironment),
    }));
  }

  function applyThreadSnapshotToState(thread: ThreadSnapshot) {
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
    const localThread = createLocalThreadSnapshot();
    isThreadsReadyRef.current = true;
    setThreadsState([localThread]);
    setThreadRequestStateById({});
    applyThreadSnapshotToState(localThread);
    setThreadError(null);
    beginThreadOperation("loading");
  }

  // Thread persistence and title-refresh orchestration.
  async function saveThreadSnapshotToDatabase(
    snapshot: ThreadSnapshot,
    signature: string,
    options: {
      showBusy?: boolean;
      reportError?: boolean;
    } = {},
  ): Promise<boolean> {
    const showBusy = options.showBusy !== false;
    const reportError = options.reportError !== false;
    if (!shouldPersistThreadSnapshot(snapshot)) {
      return true;
    }
    const expectedUserKey = activeWorkspaceUserKeyRef.current.trim();
    if (!expectedUserKey) {
      return false;
    }

    const expectedThreadId = snapshot.id;
    const hasPersistedSignature = threadSaveSignatureByIdRef.current.has(expectedThreadId);
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
          body: JSON.stringify(snapshot),
        },
        readPayload: (response) => readJsonPayload<ThreadsApiResponse>(response, "Threads"),
        resolveAuthRequired: (status, responsePayload) =>
          resolveAuthRequired(status, responsePayload),
        readErrorMessage: (responsePayload) =>
          typeof responsePayload.error === "string" ? responsePayload.error : null,
        fallbackErrorMessage: "Failed to save thread.",
        authRequiredMessage: "Azure login is required. Open Settings and sign in to continue.",
        onAuthRequired: () => {
          setIsAzureAuthRequired(true);
          if (reportError) {
            setThreadError("Azure login is required. Open Settings and sign in to continue.");
          }
        },
      });

      const savedThread = readThreadSnapshotFromUnknown(payload.thread, {
        fallbackInstruction: DEFAULT_AGENT_INSTRUCTION,
      });
      if (!savedThread) {
        throw new Error("Saved thread payload is invalid.");
      }
      if (expectedUserKey !== activeWorkspaceUserKeyRef.current.trim()) {
        return false;
      }

      if (expectedThreadId !== savedThread.id) {
        return false;
      }

      updateThreadsState((current) => upsertThreadSnapshot(current, savedThread));
      threadSaveSignatureByIdRef.current.set(savedThread.id, signature);
      if (savedThread.id === activeThreadIdRef.current) {
        setActiveThreadNameInput(savedThread.name);
      }
      logHomeInfo("save_thread_snapshot_succeeded", "Thread snapshot saved.", {
        action: "save_thread_snapshot",
        context: {
          method,
          threadId: savedThread.id,
          messageCount: savedThread.messages.length,
          mcpServerCount: savedThread.mcpServers.length,
          operationLogCount: savedThread.mcpRpcLogs.length,
          skillSelectionCount: savedThread.skillSelections.length,
        },
      });
      return true;
    } catch (saveError) {
      if (saveError instanceof ClientApiError && saveError.kind === "auth_required") {
        return false;
      }
      logHomeError("save_thread_snapshot_failed", saveError, {
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

  async function saveThreadSnapshotSilentlyIfNeeded(threadId: string): Promise<void> {
    const normalizedThreadId = threadId.trim();
    if (!normalizedThreadId) {
      return;
    }

    const snapshot = findThreadSnapshotById(threadsRef.current, normalizedThreadId);
    if (!snapshot) {
      return;
    }
    if (!shouldPersistThreadSnapshot(snapshot)) {
      return;
    }

    const signature = buildThreadSaveSignature(snapshot);
    const savedSignature = threadSaveSignatureByIdRef.current.get(normalizedThreadId);
    if (savedSignature === signature) {
      return;
    }

    await saveThreadSnapshotToDatabase(snapshot, signature, {
      showBusy: false,
      reportError: false,
    });
  }

  async function flushActiveThreadSnapshot(): Promise<boolean> {
    const currentThreadId = activeThreadIdRef.current.trim();
    if (!currentThreadId) {
      return true;
    }

    clearThreadNameSaveTimeout();

    const baseThread = findThreadSnapshotById(threadsRef.current, currentThreadId);
    if (!baseThread) {
      return true;
    }

    const snapshot = buildThreadSnapshotFromCurrentState(baseThread, {
      includeDraftName: true,
    });
    if (!shouldPersistThreadSnapshot(snapshot)) {
      return true;
    }
    const signature = buildThreadSaveSignature(snapshot);
    const savedSignature = threadSaveSignatureByIdRef.current.get(currentThreadId);
    if (savedSignature === signature) {
      return true;
    }

    clearThreadSaveTimeout();
    return await saveThreadSnapshotToDatabase(snapshot, signature);
  }

  async function saveActiveThreadNameInBackground(
    threadId: string,
    name: string,
  ): Promise<void> {
    const normalizedThreadId = threadId.trim();
    const normalizedName = name.trim().slice(0, HOME_THREAD_NAME_MAX_LENGTH);
    if (!normalizedThreadId || !normalizedName) {
      return;
    }
    if (normalizedThreadId !== activeThreadIdRef.current.trim()) {
      return;
    }

    const baseThread = findThreadSnapshotById(threadsRef.current, normalizedThreadId);
    if (!baseThread || baseThread.name === normalizedName) {
      return;
    }
    if (!shouldPersistThreadSnapshot(baseThread)) {
      return;
    }

    const snapshot = buildThreadSnapshotFromCurrentState(baseThread, {
      includeDraftName: true,
    });
    snapshot.name = normalizedName;

    const signature = buildThreadSaveSignature(snapshot);
    const savedSignature = threadSaveSignatureByIdRef.current.get(normalizedThreadId);
    if (savedSignature === signature) {
      return;
    }

    await saveThreadSnapshotToDatabase(snapshot, signature);
  }

  async function refreshThreadTitleInBackground(options: {
    threadId: string;
    reason: "first_message" | "instruction_update" | "utility_deployment_update";
    instructionOverride?: string;
  }): Promise<void> {
    const normalizedThreadId = options.threadId.trim();
    if (!normalizedThreadId) {
      return;
    }
    if (isArchivedThread(normalizedThreadId) || isChatLocked || isLoadingUtilityAzureDeployments) {
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

    const baseThread = findThreadSnapshotById(threadsRef.current, normalizedThreadId);
    if (!baseThread || !hasThreadInteraction(baseThread)) {
      return;
    }

    const playgroundContent = buildThreadAutoTitlePlaygroundContent(baseThread.messages);
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
          if (options.reason === "utility_deployment_update" && isSwitchingAzureTenant) {
            setAzureTenantSwitchError(
              "Azure tenant switch is still applying. Retry Azure Login if this persists.",
            );
          }
          return;
        }
        throw new Error(payload.error || "Failed to generate thread title.");
      }

      const nextTitle = normalizeThreadAutoTitle(typeof payload.title === "string" ? payload.title : "");
      if (!nextTitle) {
        return;
      }

      const latestThread = findThreadSnapshotById(threadsRef.current, normalizedThreadId);
      if (!latestThread || latestThread.deletedAt !== null) {
        return;
      }

      const activeThreadId = activeThreadIdRef.current.trim();
      const currentInputName =
        normalizedThreadId === activeThreadId
          ? activeThreadNameInputRef.current.trim()
          : latestThread.name.trim();
      if (nextTitle === latestThread.name && (!currentInputName || currentInputName === nextTitle)) {
        return;
      }

      updateThreadSnapshotById(normalizedThreadId, (thread) => ({
        ...thread,
        updatedAt: new Date().toISOString(),
        name: nextTitle,
      }));

      if (normalizedThreadId === activeThreadId) {
        setActiveThreadNameInput(nextTitle);
      }

      await saveActiveThreadNameInBackground(normalizedThreadId, nextTitle);
    } catch (threadTitleError) {
      logHomeError("generate_thread_title_failed", threadTitleError, {
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
        readPayload: async (response) => (await response.json()) as ThreadsApiResponse,
        resolveAuthRequired: (status, responsePayload) =>
          resolveAuthRequired(status, responsePayload),
        readErrorMessage: (responsePayload) =>
          typeof responsePayload.error === "string" ? responsePayload.error : null,
        fallbackErrorMessage: "Failed to load threads.",
        authRequiredMessage: "Azure login is required. Open Settings and sign in to load threads.",
        onAuthRequired: () => {
          setIsAzureAuthRequired(true);
          clearThreadsState("Azure login is required. Open Settings and sign in to load threads.");
        },
      });

      if (requestSeq !== threadLoadRequestSeqRef.current) {
        return;
      }
      if (expectedUserKey !== activeWorkspaceUserKeyRef.current.trim()) {
        return;
      }

      const parsedThreads = readThreadSnapshotList(payload.threads, {
        fallbackInstruction: DEFAULT_AGENT_INSTRUCTION,
      });
      const nextThreads =
        parsedThreads.some((thread) => thread.deletedAt === null)
          ? parsedThreads
          : upsertThreadSnapshot(parsedThreads, createLocalThreadSnapshot());

      setThreadSaveSignatures(parsedThreads);
      setThreadsState(nextThreads);
      setThreadRequestStateById((current) => {
        const next: Record<string, ThreadRequestState> = {};
        const validIds = new Set(nextThreads.map((thread) => thread.id));
        for (const [threadId, state] of Object.entries(current)) {
          if (validIds.has(threadId)) {
            next[threadId] = state;
          }
        }
        return next;
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

      applyThreadSnapshotToState(nextThread);
      logHomeInfo("load_threads_succeeded", "Threads loaded.", {
        action: "load_threads",
        context: {
          threadCount: nextThreads.length,
          archivedThreadCount: nextThreads.filter((thread) => thread.deletedAt !== null).length,
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
      if (loadError instanceof ClientApiError && loadError.kind === "auth_required") {
        return;
      }

      logHomeError("load_threads_failed", loadError, {
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

  async function createThreadAndSwitch(options: {
    name?: string;
  } = {}): Promise<boolean> {
    if (!beginThreadOperation("creating")) {
      return false;
    }

    setThreadError(null);

    try {
      const currentThreadId = activeThreadIdRef.current.trim();
      const currentThread = findThreadSnapshotById(threadsRef.current, currentThreadId);
      const currentThreadSnapshot =
        currentThread ? buildThreadSnapshotFromCurrentState(currentThread) : null;

      if (
        currentThread &&
        currentThreadSnapshot &&
        !hasThreadPersistableState(currentThreadSnapshot) &&
        !threadSaveSignatureByIdRef.current.has(currentThread.id)
      ) {
        applyThreadSnapshotToState(currentThread);
        return true;
      }

      if (!readThreadRequestState(currentThreadId).isSending) {
        const saved = await flushActiveThreadSnapshot();
        if (!saved) {
          return false;
        }
      }

      const localThread = createLocalThreadSnapshot({
        name: options.name,
      });
      updateThreadsState((current) => upsertThreadSnapshot(current, localThread));
      isThreadsReadyRef.current = true;
      applyThreadSnapshotToState(localThread);
      logHomeInfo("create_thread_succeeded", "Thread created.", {
        action: "create_thread",
        context: {
          threadId: localThread.id,
          nameLength: localThread.name.length,
        },
      });
      return true;
    } catch (createError) {
      logHomeError("create_thread_failed", createError, {
        action: "create_thread",
        statusCode: 500,
      });
      setThreadError(createError instanceof Error ? createError.message : "Failed to create thread.");
      return false;
    } finally {
      endThreadOperation("creating");
    }
  }

  async function handleCreateThread() {
    const created = await createThreadAndSwitch({
      name: "",
    });
    if (created) {
      setActiveMainTab("threads");
    }
  }

  async function handleThreadRename(threadIdRaw: string, nextNameRaw: string): Promise<void> {
    const threadId = threadIdRaw.trim();
    if (!threadId) {
      return;
    }

    const normalizedName = nextNameRaw.trim().slice(0, HOME_THREAD_NAME_MAX_LENGTH);
    if (!normalizedName) {
      setThreadError("Thread name cannot be empty.");
      return;
    }

    if (isSending) {
      setThreadError("Thread state is updating. Please wait.");
      return;
    }

    if (!beginThreadOperation("clearing")) {
      return;
    }

    const targetThread = findThreadSnapshotById(threadsRef.current, threadId);
    if (!targetThread || targetThread.deletedAt !== null) {
      setThreadError("Selected thread is not available.");
      return;
    }

    if (readThreadRequestState(threadId).isSending) {
      setThreadError("Cannot rename a thread while a response is in progress.");
      return;
    }

    if (targetThread.name === normalizedName) {
      return;
    }

    setThreadError(null);
    updateThreadSnapshotById(threadId, (thread) => ({
      ...thread,
      updatedAt: new Date().toISOString(),
      name: normalizedName,
    }));

    if (threadId === activeThreadIdRef.current.trim()) {
      setActiveThreadNameInput(normalizedName);
    }

    const renamedThread = findThreadSnapshotById(threadsRef.current, threadId);
    if (!renamedThread) {
      return;
    }

    const signature = buildThreadSaveSignature(renamedThread);
    await saveThreadSnapshotToDatabase(renamedThread, signature);
  }

  function handleThreadCancel(threadIdRaw: string): void {
    const threadId = threadIdRaw.trim();
    if (!threadId) {
      return;
    }

    const targetThread = findThreadSnapshotById(threadsRef.current, threadId);
    if (!targetThread || targetThread.deletedAt !== null) {
      setThreadError("Selected thread is not available.");
      return;
    }

    const canceled = cancelThreadInProgressProcessing(threadId);
    if (!canceled) {
      return;
    }

    setThreadError(null);
    setSystemNotice(`Canceled in-progress processing for thread ${targetThread.name}.`);
    logHomeInfo("cancel_thread_processing_succeeded", "Thread processing canceled.", {
      action: "cancel_thread_processing",
      context: {
        threadId,
      },
    });
  }

  async function handleThreadClear(threadIdRaw: string): Promise<void> {
    const threadId = threadIdRaw.trim();
    if (!threadId) {
      return;
    }

    if (isSending) {
      setThreadError("Thread state is updating. Please wait.");
      return;
    }

    if (!canStartThreadOperation(threadOperationPhase)) {
      return;
    }

    const targetThread = findThreadSnapshotById(threadsRef.current, threadId);
    if (!targetThread || targetThread.deletedAt !== null) {
      setThreadError("Selected thread is not available.");
      return;
    }

    if (readThreadRequestState(threadId).isSending) {
      setThreadError("Cannot clear a thread while a response is in progress.");
      return;
    }

    if (targetThread.messages.length === 0 && targetThread.mcpRpcLogs.length === 0) {
      return;
    }

    setThreadError(null);

    try {
      const targetThreadForSave =
        threadId === activeThreadIdRef.current.trim()
          ? (() => {
              const activeThread = findThreadSnapshotById(threadsRef.current, threadId);
              if (!activeThread) {
                return null;
              }
              const snapshot = buildThreadSnapshotFromCurrentState(activeThread, {
                includeDraftName: true,
              });
              return {
                ...snapshot,
                messages: [],
                mcpRpcLogs: [],
              };
            })()
          : {
              ...targetThread,
              updatedAt: new Date().toISOString(),
              messages: [],
              mcpRpcLogs: [],
            };

      if (!targetThreadForSave) {
        return;
      }

      updateThreadsState((current) => upsertThreadSnapshot(current, targetThreadForSave));

      setThreadRequestStateById((current) => {
        const next = { ...current };
        delete next[threadId];
        return next;
      });

      if (threadId === activeThreadIdRef.current.trim()) {
        applyThreadSnapshotToState(targetThreadForSave);
      }

      const signature = buildThreadSaveSignature(targetThreadForSave);
      const saved = await saveThreadSnapshotToDatabase(targetThreadForSave, signature);
      if (!saved) {
        return;
      }

      logHomeInfo("clear_thread_succeeded", "Thread content cleared.", {
        action: "clear_thread",
        context: {
          threadId,
        },
      });
    } catch (clearError) {
      logHomeError("clear_thread_failed", clearError, {
        action: "clear_thread",
        statusCode: 500,
        context: {
          threadId,
        },
      });
      setThreadError(clearError instanceof Error ? clearError.message : "Failed to clear thread.");
    } finally {
      endThreadOperation("clearing");
    }
  }

  async function handleThreadLogicalDelete(threadIdRaw: string): Promise<void> {
    const threadId = threadIdRaw.trim();
    if (!threadId) {
      return;
    }

    if (isSending) {
      setThreadError("Thread state is updating. Please wait.");
      return;
    }

    if (!beginThreadOperation("deleting")) {
      return;
    }

    const targetThread = findThreadSnapshotById(threadsRef.current, threadId);
    if (!targetThread || targetThread.deletedAt !== null) {
      setThreadError("Selected thread is not available.");
      return;
    }
    if (!hasThreadInteraction(targetThread)) {
      setThreadError("Threads without messages cannot be deleted.");
      return;
    }

    if (readThreadRequestState(threadId).isSending) {
      setThreadError("Cannot delete a thread while a response is in progress.");
      return;
    }

    setThreadError(null);

    try {
      const currentThreadId = activeThreadIdRef.current.trim();
      if (!readThreadRequestState(currentThreadId).isSending) {
        const saved = await flushActiveThreadSnapshot();
        if (!saved) {
          return;
        }
      }

      const { payload } = await requestClientApi<ThreadsApiResponse>({
        url: `/api/threads/${encodeURIComponent(threadId)}`,
        init: {
          method: "DELETE",
        },
        readPayload: (response) => readJsonPayload<ThreadsApiResponse>(response, "Threads"),
        resolveAuthRequired: (status, responsePayload) =>
          resolveAuthRequired(status, responsePayload),
        readErrorMessage: (responsePayload) =>
          typeof responsePayload.error === "string" ? responsePayload.error : null,
        fallbackErrorMessage: "Failed to delete thread.",
        authRequiredMessage: "Azure login is required. Open Settings and sign in to continue.",
        onAuthRequired: () => {
          setIsAzureAuthRequired(true);
        },
      });

      const deletedThread = readThreadSnapshotFromUnknown(payload.thread, {
        fallbackInstruction: DEFAULT_AGENT_INSTRUCTION,
      });
      if (!deletedThread || deletedThread.id !== threadId || deletedThread.deletedAt === null) {
        throw new Error("Deleted thread payload is invalid.");
      }

      setThreadRequestStateById((current) => {
        const next = { ...current };
        delete next[threadId];
        return next;
      });
      await loadThreads();
      logHomeInfo("delete_thread_succeeded", "Thread archived.", {
        action: "delete_thread",
        context: {
          threadId,
        },
      });
    } catch (deleteError) {
      if (deleteError instanceof ClientApiError && deleteError.kind === "auth_required") {
        setThreadError(deleteError.message);
        return;
      }
      logHomeError("delete_thread_failed", deleteError, {
        action: "delete_thread",
        statusCode: 500,
        context: {
          threadId,
        },
      });
      setThreadError(mapApiError(deleteError, "Failed to delete thread."));
    } finally {
      endThreadOperation("deleting");
    }
  }

  async function handleThreadRestore(threadIdRaw: string): Promise<void> {
    const threadId = threadIdRaw.trim();
    if (!threadId) {
      return;
    }

    if (isSending) {
      setThreadError("Thread state is updating. Please wait.");
      return;
    }

    if (!beginThreadOperation("restoring")) {
      return;
    }

    const targetThread = findThreadSnapshotById(threadsRef.current, threadId);
    if (!targetThread || targetThread.deletedAt === null) {
      setThreadError("Selected archive is not available.");
      return;
    }

    setThreadError(null);

    try {
      const currentThreadId = activeThreadIdRef.current.trim();
      if (!readThreadRequestState(currentThreadId).isSending) {
        const saved = await flushActiveThreadSnapshot();
        if (!saved) {
          return;
        }
      }

      const { payload } = await requestClientApi<ThreadsApiResponse>({
        url: `/api/threads/${encodeURIComponent(threadId)}`,
        init: {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            archived: false,
          }),
        },
        readPayload: (response) => readJsonPayload<ThreadsApiResponse>(response, "Threads"),
        resolveAuthRequired: (status, responsePayload) =>
          resolveAuthRequired(status, responsePayload),
        readErrorMessage: (responsePayload) =>
          typeof responsePayload.error === "string" ? responsePayload.error : null,
        fallbackErrorMessage: "Failed to restore thread.",
        authRequiredMessage: "Azure login is required. Open Settings and sign in to continue.",
        onAuthRequired: () => {
          setIsAzureAuthRequired(true);
        },
      });

      const restoredThread = readThreadSnapshotFromUnknown(payload.thread, {
        fallbackInstruction: DEFAULT_AGENT_INSTRUCTION,
      });
      if (!restoredThread || restoredThread.id !== threadId || restoredThread.deletedAt !== null) {
        throw new Error("Restored thread payload is invalid.");
      }

      updateThreadsState((current) => upsertThreadSnapshot(current, restoredThread));
      threadSaveSignatureByIdRef.current.set(restoredThread.id, buildThreadSaveSignature(restoredThread));
      applyThreadSnapshotToState(restoredThread);
      logHomeInfo("restore_thread_succeeded", "Thread restored.", {
        action: "restore_thread",
        context: {
          threadId,
        },
      });
    } catch (restoreError) {
      if (restoreError instanceof ClientApiError && restoreError.kind === "auth_required") {
        setThreadError(restoreError.message);
        return;
      }
      logHomeError("restore_thread_failed", restoreError, {
        action: "restore_thread",
        statusCode: 500,
        context: {
          threadId,
        },
      });
      setThreadError(mapApiError(restoreError, "Failed to restore thread."));
    } finally {
      endThreadOperation("restoring");
    }
  }

  async function handleThreadChange(nextThreadIdRaw: string) {
    const nextThreadId = nextThreadIdRaw.trim();
    setThreadError(null);
    if (!nextThreadId || nextThreadId === activeThreadIdRef.current) {
      return;
    }

    const nextThread = findThreadSnapshotById(threadsRef.current, nextThreadId);
    if (!nextThread) {
      setThreadError("Selected thread is not available.");
      return;
    }
    if (!beginThreadOperation("switching")) {
      return;
    }
    try {
      const currentThreadId = activeThreadIdRef.current.trim();
      if (!readThreadRequestState(currentThreadId).isSending) {
        const saved = await flushActiveThreadSnapshot();
        if (!saved) {
          return;
        }
      }

      applyThreadSnapshotToState(nextThread);
      logHomeInfo("switch_thread_succeeded", "Thread switched.", {
        action: "switch_thread",
        context: {
          fromThreadId: currentThreadId,
          toThreadId: nextThread.id,
        },
      });
    } finally {
      endThreadOperation("switching");
    }
  }

  // Azure identity, selection, and deployment discovery.
  async function loadAzureSelectionPreference(
    tenantId: string,
    principalId: string,
  ): Promise<AzureSelectionPreference | null> {
    const normalizedTenantId = tenantId.trim();
    const normalizedPrincipalId = principalId.trim();
    if (!normalizedTenantId || !normalizedPrincipalId) {
      return null;
    }

    try {
      const response = await fetch("/api/azure/selection", {
        method: "GET",
      });
      const payload = (await response.json()) as AzureSelectionApiResponse;
      if (!response.ok) {
        return null;
      }

      return readAzureSelectionFromUnknown(
        payload.selection,
        normalizedTenantId,
        normalizedPrincipalId,
      );
    } catch (selectionError) {
      logHomeError("load_azure_selection_failed", selectionError, {
        action: "load_azure_selection",
      });
      return null;
    }
  }

  async function saveAzureSelectionPreference(
    selection:
      | {
          target: "playground";
          tenantId: string;
          principalId: string;
          projectId: string;
          deploymentName: string;
        }
      | {
          target: "utility";
          tenantId: string;
          principalId: string;
          projectId: string;
          deploymentName: string;
          reasoningEffort: ReasoningEffort;
        },
  ): Promise<void> {
    const currentPreferredSelection = preferredAzureSelectionRef.current;
    const hasIdentityScopedPreferredSelection =
      currentPreferredSelection !== null &&
      currentPreferredSelection.tenantId === selection.tenantId &&
      currentPreferredSelection.principalId === selection.principalId;
    const nextPreferredSelection: AzureSelectionPreference =
      hasIdentityScopedPreferredSelection
        ? {
            ...currentPreferredSelection,
            theme: currentPreferredSelection.theme,
            playground: currentPreferredSelection.playground
              ? { ...currentPreferredSelection.playground }
              : null,
            utility: currentPreferredSelection.utility
              ? { ...currentPreferredSelection.utility }
              : null,
          }
        : {
            tenantId: selection.tenantId,
            principalId: selection.principalId,
            theme,
            playground: null,
            utility: null,
          };

    const targetSelection = {
      projectId: selection.projectId,
      deploymentName: selection.deploymentName,
    };
    if (selection.target === "playground") {
      nextPreferredSelection.playground = targetSelection;
    } else {
      nextPreferredSelection.utility = {
        ...targetSelection,
        reasoningEffort: selection.reasoningEffort,
      };
    }
    preferredAzureSelectionRef.current = nextPreferredSelection;
    const persistedThemeMode = hasIdentityScopedPreferredSelection
      ? currentPreferredSelection.theme
      : null;

    try {
      const response = await fetch("/api/azure/selection", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          target: selection.target,
          projectId: selection.projectId,
          deploymentName: selection.deploymentName,
          theme: persistedThemeMode,
          ...(selection.target === "utility"
            ? { reasoningEffort: selection.reasoningEffort }
            : {}),
        }),
      });
      if (!response.ok) {
        return;
      }
    } catch (selectionSaveError) {
      logHomeError("save_azure_selection_failed", selectionSaveError, {
        action: "save_azure_selection",
      });
      // Ignore persistence failures and continue normal UI flow.
    }
  }

  async function saveThemePreference(nextThemeMode: ThemeMode): Promise<void> {
    const tenantId = activeAzureTenantIdRef.current.trim();
    const principalId = activeAzurePrincipalIdRef.current.trim();
    if (!tenantId || !principalId) {
      return;
    }

    const currentPreferredSelection = preferredAzureSelectionRef.current;
    const nextPreferredSelection: AzureSelectionPreference =
      currentPreferredSelection &&
      currentPreferredSelection.tenantId === tenantId &&
      currentPreferredSelection.principalId === principalId
        ? {
            ...currentPreferredSelection,
            theme: nextThemeMode,
            playground: currentPreferredSelection.playground
              ? { ...currentPreferredSelection.playground }
              : null,
            utility: currentPreferredSelection.utility
              ? { ...currentPreferredSelection.utility }
              : null,
          }
        : {
            tenantId,
            principalId,
            theme: nextThemeMode,
            playground: null,
            utility: null,
          };
    preferredAzureSelectionRef.current = nextPreferredSelection;

    try {
      const response = await fetch("/api/azure/selection", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          theme: nextThemeMode,
        }),
      });
      if (!response.ok) {
        return;
      }
    } catch (selectionSaveError) {
      logHomeError("save_home_theme_failed", selectionSaveError, {
        action: "save_home_theme",
      });
      // Ignore persistence failures and continue normal UI flow.
    }
  }

  function readAzureTenantCacheKey(tenantIdRaw: string): string {
    return tenantIdRaw.trim().toLowerCase();
  }

  function readAzureDeploymentCacheKey(tenantIdRaw: string, projectIdRaw: string): string {
    const tenantKey = readAzureTenantCacheKey(tenantIdRaw);
    const projectId = projectIdRaw.trim();
    if (!tenantKey || !projectId) {
      return "";
    }
    return `${tenantKey}::${projectId}`;
  }

  function includesAzureDeploymentName(
    deployments: AzureDeploymentOption[],
    deploymentNameRaw: string,
  ): boolean {
    const deploymentName = deploymentNameRaw.trim();
    if (!deploymentName) {
      return false;
    }

    return deployments.some((deployment) => deployment.name === deploymentName);
  }

  function cloneAzureDeploymentOption(deployment: AzureDeploymentOption): AzureDeploymentOption {
    return {
      ...deployment,
      reasoningEffortOptions: [...deployment.reasoningEffortOptions],
    };
  }

  function resolveSupportedReasoningEffortOptions(options: ReasoningEffort[]): ReasoningEffort[] {
    const optionSet = new Set(options);
    return HOME_REASONING_EFFORT_OPTIONS.filter((effort) => optionSet.has(effort));
  }

  function isWebSearchCompatibleReasoningEffort(value: ReasoningEffort): boolean {
    return value !== "minimal";
  }

  function isReasoningEffortCompatibleWithDeployment(
    deploymentNameRaw: string,
    value: ReasoningEffort,
  ): boolean {
    const deploymentName = deploymentNameRaw.trim().toLowerCase();
    if (deploymentName.startsWith("gpt-5.4")) {
      return value !== "minimal";
    }

    return true;
  }

  function filterReasoningEffortOptionsForDeploymentCompatibility(
    options: ReasoningEffort[],
    deploymentNameRaw: string,
  ): ReasoningEffort[] {
    return options.filter((value) =>
      isReasoningEffortCompatibleWithDeployment(deploymentNameRaw, value),
    );
  }

  function filterReasoningEffortOptionsForWebSearch(
    options: ReasoningEffort[],
    webSearchEnabledValue: boolean,
  ): ReasoningEffort[] {
    if (!webSearchEnabledValue) {
      return options;
    }

    return options.filter(isWebSearchCompatibleReasoningEffort);
  }

  function resolveEffectiveReasoningEffort(
    current: ReasoningEffort,
    options: ReasoningEffort[],
    fallback: ReasoningEffort,
  ): ReasoningEffort {
    if (options.includes(current)) {
      return current;
    }

    if (options.includes(fallback)) {
      return fallback;
    }

    return options[0] ?? HOME_DEFAULT_REASONING_EFFORT;
  }

  function readCachedAzureProjectCatalog(
    tenantIdRaw: string,
  ): AzureProjectCatalogCacheEntry | null {
    const tenantKey = readAzureTenantCacheKey(tenantIdRaw);
    if (!tenantKey) {
      return null;
    }
    return azureProjectCatalogCacheByTenantId[tenantKey] ?? null;
  }

  function cacheAzureProjectCatalog(entry: AzureProjectCatalogCacheEntry): void {
    const tenantKey = readAzureTenantCacheKey(entry.tenantId);
    if (!tenantKey) {
      return;
    }
    setAzureProjectCatalogCacheByTenantId((current) => ({
      ...current,
      [tenantKey]: {
        tenantId: entry.tenantId,
        principalId: entry.principalId,
        principal: entry.principal ? { ...entry.principal } : null,
        tenants: entry.tenants.map((tenant) => ({ ...tenant })),
        projects: entry.projects.map((project) => ({ ...project })),
      },
    }));
  }

  function readCachedAzureDeployments(
    tenantIdRaw: string,
    projectIdRaw: string,
  ): AzureDeploymentOption[] | null {
    const deploymentKey = readAzureDeploymentCacheKey(tenantIdRaw, projectIdRaw);
    if (!deploymentKey) {
      return null;
    }
    const cached = azureDeploymentCatalogCacheByTenantProjectKey[deploymentKey];
    return cached ? cached.map(cloneAzureDeploymentOption) : null;
  }

  function cacheAzureDeployments(
    tenantIdRaw: string,
    projectIdRaw: string,
    deployments: AzureDeploymentOption[],
  ): void {
    const deploymentKey = readAzureDeploymentCacheKey(tenantIdRaw, projectIdRaw);
    if (!deploymentKey) {
      return;
    }
    setAzureDeploymentCatalogCacheByTenantProjectKey((current) => ({
      ...current,
      [deploymentKey]: deployments.map(cloneAzureDeploymentOption),
    }));
  }

  function clearAzureCatalogCacheByTenant(tenantIdRaw: string): void {
    const tenantKey = readAzureTenantCacheKey(tenantIdRaw);
    if (!tenantKey) {
      return;
    }
    setAzureProjectCatalogCacheByTenantId((current) => {
      if (!(tenantKey in current)) {
        return current;
      }
      const next = { ...current };
      delete next[tenantKey];
      return next;
    });
    setAzureDeploymentCatalogCacheByTenantProjectKey((current) => {
      const prefix = `${tenantKey}::`;
      let changed = false;
      const next: AzureDeploymentCatalogCacheByTenantProjectKey = {};
      for (const [key, deployments] of Object.entries(current)) {
        if (key.startsWith(prefix)) {
          changed = true;
          continue;
        }
        next[key] = deployments.map(cloneAzureDeploymentOption);
      }
      return changed ? next : current;
    });
  }

  function clearAzureCatalogCache(): void {
    setAzureProjectCatalogCacheByTenantId({});
    setAzureDeploymentCatalogCacheByTenantProjectKey({});
  }

  function cancelAzureDeploymentLoad(target: "playground" | "utility"): void {
    if (target === "playground") {
      playgroundAzureDeploymentRequestSeqRef.current += 1;
      setIsLoadingPlaygroundAzureDeployments(false);
      return;
    }

    utilityAzureDeploymentRequestSeqRef.current += 1;
    setIsLoadingUtilityAzureDeployments(false);
  }

  function cancelAzureDeploymentLoads(): void {
    cancelAzureDeploymentLoad("playground");
    cancelAzureDeploymentLoad("utility");
  }

  function clearActiveAzureIdentity(): void {
    activeAzureTenantIdRef.current = "";
    activeAzurePrincipalIdRef.current = "";
    activeWorkspaceUserKeyRef.current = "";
    preferredAzureSelectionRef.current = null;
    cancelAzureDeploymentLoads();
    clearAzureCatalogCache();
    setAzureTenants([]);
    setActiveAzurePrincipal(null);
    setAzureTenantSwitchError(null);
    setIsReloadingAzureCatalog(false);
    setUtilityReasoningEffort(HOME_DEFAULT_UTILITY_REASONING_EFFORT);
  }

  function updateActiveAzureIdentity(tenantId: string, principalId: string): string {
    activeAzureTenantIdRef.current = tenantId;
    activeAzurePrincipalIdRef.current = principalId;
    const nextWorkspaceUserKey = tenantId && principalId ? `${tenantId}::${principalId}` : "";
    activeWorkspaceUserKeyRef.current = nextWorkspaceUserKey;
    return nextWorkspaceUserKey;
  }

  async function reloadWorkspaceStateForActiveIdentity(
    waitForWorkspaceStateReload: boolean,
  ): Promise<void> {
    clearWorkspaceMcpServerProfilesState();
    clearThreadsState();

    const nextWorkspaceUserKey = activeWorkspaceUserKeyRef.current.trim();
    if (!nextWorkspaceUserKey) {
      return;
    }

    showThreadReloadPlaceholder();

    const reloadState = async () => {
      await loadWorkspaceMcpServerProfiles();
      await loadThreads();
    };

    if (waitForWorkspaceStateReload) {
      await reloadState();
      return;
    }

    void reloadState();
  }

  async function loadAzureProjects(
    options: LoadAzureProjectsOptions = {},
  ): Promise<LoadAzureProjectsResult> {
    const forceReload = options.force === true;
    const preferredTenantId = options.preferredTenantId?.trim() ?? "";
    const waitForWorkspaceStateReload = options.waitForWorkspaceStateReload === true;
    const useCachedProjectCatalog = shouldUseCachedAzureProjectCatalog({
      forceReload,
      isAzureAuthRequired,
    });
    const requestSeq = azureConnectionsRequestSeqRef.current + 1;
    azureConnectionsRequestSeqRef.current = requestSeq;
    setIsLoadingAzureConnections(true);

    try {
      if (useCachedProjectCatalog) {
        const tenantIdForCache = preferredTenantId || activeAzureTenantIdRef.current.trim();
        const cachedCatalog = readCachedAzureProjectCatalog(tenantIdForCache);
        if (cachedCatalog) {
          const previousWorkspaceUserKey = activeWorkspaceUserKeyRef.current;
          const nextWorkspaceUserKey = updateActiveAzureIdentity(
            cachedCatalog.tenantId,
            cachedCatalog.principalId,
          );
          if (!nextWorkspaceUserKey) {
            clearWorkspaceMcpServerProfilesState();
            clearThreadsState();
          } else if (previousWorkspaceUserKey !== nextWorkspaceUserKey) {
            await reloadWorkspaceStateForActiveIdentity(waitForWorkspaceStateReload);
          } else if (!isThreadsReadyRef.current && !isLoadingThreads) {
            if (waitForWorkspaceStateReload) {
              await loadThreads();
            } else {
              void loadThreads();
            }
          }
          if (
            shouldScheduleWorkspaceMcpServerProfileLoginRetry(
              isAzureAuthRequired,
              nextWorkspaceUserKey,
            )
          ) {
            // After login completes, token propagation can briefly lag for MCP route auth.
            scheduleWorkspaceMcpServerProfileLoginRetry(nextWorkspaceUserKey);
          } else {
            clearWorkspaceMcpServerProfileLoginRetryTimeout();
          }
          const preferredSelection =
            cachedCatalog.tenantId && cachedCatalog.principalId
              ? await loadAzureSelectionPreference(
                  cachedCatalog.tenantId,
                  cachedCatalog.principalId,
                )
              : null;
          if (requestSeq !== azureConnectionsRequestSeqRef.current) {
            return {
              authRequired: false,
              tenantSwitchPending: false,
            };
          }
          preferredAzureSelectionRef.current = preferredSelection;
          if (preferredSelection?.theme) {
            setTheme(preferredSelection.theme);
          }
          const preferredPlaygroundProjectId = preferredSelection?.playground?.projectId ?? "";
          const preferredUtilityProjectId = preferredSelection?.utility?.projectId ?? "";
          const preferredUtilityReasoningEffort =
            preferredSelection?.utility?.reasoningEffort ?? HOME_DEFAULT_UTILITY_REASONING_EFFORT;
          const knownProjectIds = new Set(cachedCatalog.projects.map((connection) => connection.id));
          const defaultProjectId = cachedCatalog.projects[0]?.id ?? "";
          const nextPlaygroundProjectId = resolveInitialAzureProjectId({
            knownProjectIds,
            currentProjectId: selectedPlaygroundAzureConnectionIdRef.current,
            preferredProjectId: preferredPlaygroundProjectId,
            defaultProjectId,
          });
          const nextUtilityProjectId = resolveInitialAzureProjectId({
            knownProjectIds,
            currentProjectId: selectedUtilityAzureConnectionIdRef.current,
            preferredProjectId: preferredUtilityProjectId,
            fallbackProjectId: nextPlaygroundProjectId,
            defaultProjectId,
          });

          cancelAzureDeploymentLoads();
          setAzureConnections(cachedCatalog.projects.map((project) => ({ ...project })));
          setAzureTenants(cachedCatalog.tenants.map((tenant) => ({ ...tenant })));
          setActiveAzurePrincipal(cachedCatalog.principal ? { ...cachedCatalog.principal } : null);
          setPlaygroundAzureDeployments([]);
          setUtilityAzureDeployments([]);
          setAzureConnectionError(null);
          setPlaygroundAzureDeploymentError(null);
          setUtilityAzureDeploymentError(null);
          setUtilityReasoningEffort(preferredUtilityReasoningEffort);
          setSelectedPlaygroundAzureConnectionId(nextPlaygroundProjectId);
          setSelectedUtilityAzureConnectionId(nextUtilityProjectId);
          return {
            authRequired: false,
            tenantSwitchPending: false,
          };
        }
      }

      const projectsRequestUrl = preferredTenantId
        ? `/api/azure/projects?tenantId=${encodeURIComponent(preferredTenantId)}`
        : "/api/azure/projects";
      const { payload } = await requestClientApi<AzureProjectsApiResponse>({
        url: projectsRequestUrl,
        init: {
          method: "GET",
        },
        readPayload: (response) => readJsonPayload<AzureProjectsApiResponse>(response, "Azure projects"),
        resolveAuthRequired: (status, responsePayload) =>
          resolveAuthRequired(status, responsePayload),
        readErrorMessage: (responsePayload) =>
          typeof responsePayload.error === "string" ? responsePayload.error : null,
        fallbackErrorMessage: "Failed to load Azure projects.",
        authRequiredMessage: "Azure login is required. Open Settings and sign in to load threads.",
      });
      if (requestSeq !== azureConnectionsRequestSeqRef.current) {
        return {
          authRequired: isAzureAuthRequired,
          tenantSwitchPending: false,
        };
      }

      const parsedProjects = readAzureProjectList(payload.projects);
      const tenantId = readTenantIdFromUnknown(payload.tenantId);
      const principalId = readPrincipalIdFromUnknown(payload.principalId);
      const loadResult = buildAzureProjectsLoadResult({
        authRequired: payload.authRequired === true,
        preferredTenantId,
        resolvedTenantId: tenantId,
      });
      if (loadResult.tenantSwitchPending) {
        logHomeWarning(
          "azure_tenant_switch_verification_pending",
          "Resolved tenant does not match requested tenant yet.",
          {
            action: "load_azure_projects",
            context: {
              requestedTenantId: preferredTenantId,
              resolvedTenantId: tenantId,
            },
          },
        );
        return loadResult;
      }
      const parsedTenants = resolveAzureTenantOptions(readAzureTenantList(payload.tenants), tenantId);
      const parsedPrincipal =
        readAzurePrincipalProfileFromUnknown(payload.principal, tenantId, principalId) ??
        (tenantId && principalId
          ? {
              tenantId,
              principalId,
              displayName: principalId,
              principalName: "",
              principalType: "unknown" as const,
            }
          : null);
      const previousWorkspaceUserKey = activeWorkspaceUserKeyRef.current;
      const nextWorkspaceUserKey = updateActiveAzureIdentity(tenantId, principalId);
      if (!nextWorkspaceUserKey) {
        clearWorkspaceMcpServerProfilesState();
        clearThreadsState();
      } else if (previousWorkspaceUserKey !== nextWorkspaceUserKey) {
        await reloadWorkspaceStateForActiveIdentity(waitForWorkspaceStateReload);
      } else if (!isThreadsReadyRef.current && !isLoadingThreads) {
        if (waitForWorkspaceStateReload) {
          await loadThreads();
        } else {
          void loadThreads();
        }
      }
      if (shouldScheduleWorkspaceMcpServerProfileLoginRetry(isAzureAuthRequired, nextWorkspaceUserKey)) {
        // After login completes, token propagation can briefly lag for MCP route auth.
        scheduleWorkspaceMcpServerProfileLoginRetry(nextWorkspaceUserKey);
      } else {
        clearWorkspaceMcpServerProfileLoginRetryTimeout();
      }
      const preferredSelection =
        tenantId && principalId
          ? await loadAzureSelectionPreference(tenantId, principalId)
          : null;
      if (requestSeq !== azureConnectionsRequestSeqRef.current) {
        return {
          authRequired: payload.authRequired === true,
          tenantSwitchPending: false,
        };
      }
      preferredAzureSelectionRef.current = preferredSelection;
      if (preferredSelection?.theme) {
        setTheme(preferredSelection.theme);
      }
      if (tenantId && principalId) {
        cacheAzureProjectCatalog({
          tenantId,
          principalId,
          principal: parsedPrincipal,
          tenants: parsedTenants,
          projects: parsedProjects,
        });
      }
      const preferredPlaygroundProjectId = preferredSelection?.playground?.projectId ?? "";
      const preferredUtilityProjectId = preferredSelection?.utility?.projectId ?? "";
      const preferredUtilityReasoningEffort =
        preferredSelection?.utility?.reasoningEffort ?? HOME_DEFAULT_UTILITY_REASONING_EFFORT;
      const knownProjectIds = new Set(parsedProjects.map((connection) => connection.id));
      const defaultProjectId = parsedProjects[0]?.id ?? "";
      const nextPlaygroundProjectId = resolveInitialAzureProjectId({
        knownProjectIds,
        currentProjectId: selectedPlaygroundAzureConnectionIdRef.current,
        preferredProjectId: preferredPlaygroundProjectId,
        defaultProjectId,
      });
      const nextUtilityProjectId = resolveInitialAzureProjectId({
        knownProjectIds,
        currentProjectId: selectedUtilityAzureConnectionIdRef.current,
        preferredProjectId: preferredUtilityProjectId,
        fallbackProjectId: nextPlaygroundProjectId,
        defaultProjectId,
      });

      cancelAzureDeploymentLoads();
      setAzureConnections(parsedProjects);
      setAzureTenants(parsedTenants);
      setActiveAzurePrincipal(parsedPrincipal);
      setPlaygroundAzureDeployments([]);
      setUtilityAzureDeployments([]);
      setIsAzureAuthRequired((currentAuthRequired) =>
        resolveAzureAuthRequiredState({
          currentAuthRequired,
          nextAuthRequired: loadResult.authRequired,
          source: "projects_response",
        }),
      );
      setAzureConnectionError(null);
      setPlaygroundAzureDeploymentError(null);
      setUtilityAzureDeploymentError(null);
      setUtilityReasoningEffort(preferredUtilityReasoningEffort);
      setSelectedPlaygroundAzureConnectionId(nextPlaygroundProjectId);
      setSelectedUtilityAzureConnectionId(nextUtilityProjectId);
      return loadResult;
    } catch (loadError) {
      if (requestSeq !== azureConnectionsRequestSeqRef.current) {
        return {
          authRequired: isAzureAuthRequired,
          tenantSwitchPending: false,
        };
      }
      logHomeError("load_azure_projects_failed", loadError, {
        action: "load_azure_projects",
      });
      const errorMessage = mapApiError(loadError, "Failed to load Azure projects.");
      const nextAuthRequired =
        loadError instanceof ClientApiError
          ? loadError.kind === "auth_required"
          : isLikelyChatAzureAuthError(errorMessage);
      clearActiveAzureIdentity();
      clearWorkspaceMcpServerProfilesState();
      clearThreadsState(
        nextAuthRequired
          ? "Azure login is required. Open Settings and sign in to load threads."
          : null,
      );
      setIsAzureAuthRequired(nextAuthRequired);
      setAzureConnections([]);
      setPlaygroundAzureDeployments([]);
      setUtilityAzureDeployments([]);
      setIsLoadingPlaygroundAzureDeployments(false);
      setIsLoadingUtilityAzureDeployments(false);
      setSelectedPlaygroundAzureConnectionId("");
      setSelectedPlaygroundAzureDeploymentName("");
      setSelectedUtilityAzureConnectionId("");
      setSelectedUtilityAzureDeploymentName("");
      setUtilityReasoningEffort(HOME_DEFAULT_UTILITY_REASONING_EFFORT);
      setAzureConnectionError(nextAuthRequired ? null : errorMessage);
      setPlaygroundAzureDeploymentError(null);
      setUtilityAzureDeploymentError(null);
      return {
        authRequired: nextAuthRequired,
        tenantSwitchPending: false,
      };
    } finally {
      if (requestSeq === azureConnectionsRequestSeqRef.current) {
        setIsLoadingAzureConnections(false);
      }
    }
  }

  async function loadAzureDeployments(
    projectId: string,
    target: "playground" | "utility",
    options: LoadAzureDeploymentsOptions = {},
  ): Promise<void> {
    const normalizedProjectId = projectId.trim();
    const forceReload = options.force !== false;
    if (!normalizedProjectId) {
      if (target === "playground") {
        setPlaygroundAzureDeployments([]);
        setSelectedPlaygroundAzureDeploymentName("");
        setPlaygroundAzureDeploymentError(null);
      } else {
        setUtilityAzureDeployments([]);
        setSelectedUtilityAzureDeploymentName("");
        setUtilityAzureDeploymentError(null);
      }
      return;
    }

    const applyDeployments = (deployments: AzureDeploymentOption[]) => {
      const preferredSelection = preferredAzureSelectionRef.current;
      const preferredDeploymentName =
        preferredSelection &&
        preferredSelection.tenantId === activeAzureTenantIdRef.current &&
        preferredSelection.principalId === activeAzurePrincipalIdRef.current &&
        (target === "playground"
          ? preferredSelection.playground?.projectId === normalizedProjectId
          : preferredSelection.utility?.projectId === normalizedProjectId)
          ? (target === "playground"
              ? preferredSelection.playground?.deploymentName
              : preferredSelection.utility?.deploymentName) ?? ""
          : "";

      setIsAzureAuthRequired((currentAuthRequired) =>
        resolveAzureAuthRequiredState({
          currentAuthRequired,
          nextAuthRequired: false,
          source: "background_success",
        }),
      );
      if (target === "playground") {
        setPlaygroundAzureDeployments(deployments);
        setSelectedPlaygroundAzureDeploymentName((current) =>
          deployments.some((deployment) => deployment.name === current)
            ? current
            : preferredDeploymentName &&
                deployments.some((deployment) => deployment.name === preferredDeploymentName)
              ? preferredDeploymentName
              : deployments[0]?.name ?? "",
        );
        setPlaygroundAzureDeploymentError(
          deployments.length === 0
            ? "No Agents SDK-compatible deployments found for this project."
            : null,
        );
      } else {
        setUtilityAzureDeployments(deployments);
        setSelectedUtilityAzureDeploymentName((current) =>
          deployments.some((deployment) => deployment.name === current)
            ? current
            : preferredDeploymentName &&
                deployments.some((deployment) => deployment.name === preferredDeploymentName)
              ? preferredDeploymentName
              : deployments[0]?.name ?? "",
        );
        setUtilityAzureDeploymentError(
          deployments.length === 0
            ? "No Agents SDK-compatible deployments found for this project."
            : null,
        );
      }
    };

    if (!forceReload) {
      const cachedDeployments = readCachedAzureDeployments(
        activeAzureTenantIdRef.current,
        normalizedProjectId,
      );
      if (cachedDeployments) {
        applyDeployments(cachedDeployments);
        return;
      }
    }

    const requestSeq =
      target === "playground"
        ? playgroundAzureDeploymentRequestSeqRef.current + 1
        : utilityAzureDeploymentRequestSeqRef.current + 1;
    if (target === "playground") {
      playgroundAzureDeploymentRequestSeqRef.current = requestSeq;
      setIsLoadingPlaygroundAzureDeployments(true);
      setPlaygroundAzureDeploymentError(null);
    } else {
      utilityAzureDeploymentRequestSeqRef.current = requestSeq;
      setIsLoadingUtilityAzureDeployments(true);
      setUtilityAzureDeploymentError(null);
    }

    try {
      const { payload } = await requestClientApi<AzureProjectsApiResponse>({
        url: `/api/azure/projects/${encodeURIComponent(normalizedProjectId)}/deployments`,
        init: {
          method: "GET",
        },
        readPayload: (response) =>
          readJsonPayload<AzureProjectsApiResponse>(response, "Azure deployments"),
        resolveAuthRequired: (status, responsePayload) =>
          resolveAuthRequired(status, responsePayload),
        readErrorMessage: (responsePayload) =>
          typeof responsePayload.error === "string" ? responsePayload.error : null,
        fallbackErrorMessage: "Failed to load deployments for the selected project.",
        authRequiredMessage: "Azure login is required. Open Settings and sign in to load threads.",
      });
      const activeRequestSeq =
        target === "playground"
          ? playgroundAzureDeploymentRequestSeqRef.current
          : utilityAzureDeploymentRequestSeqRef.current;
      if (requestSeq !== activeRequestSeq) {
        return;
      }

      const selectedProjectId =
        target === "playground"
          ? selectedPlaygroundAzureConnectionIdRef.current.trim()
          : selectedUtilityAzureConnectionIdRef.current.trim();
      if (!selectedProjectId || selectedProjectId !== normalizedProjectId) {
        return;
      }

      const parsedDeployments = readAzureDeploymentList(payload.deployments);
      const tenantIdFromPayload = readTenantIdFromUnknown(payload.tenantId);
      const principalIdFromPayload = readPrincipalIdFromUnknown(payload.principalId);
      if (tenantIdFromPayload) {
        activeAzureTenantIdRef.current = tenantIdFromPayload;
      }
      if (principalIdFromPayload) {
        activeAzurePrincipalIdRef.current = principalIdFromPayload;
      }
      const parsedPrincipal = readAzurePrincipalProfileFromUnknown(
        payload.principal,
        activeAzureTenantIdRef.current,
        activeAzurePrincipalIdRef.current,
      );
      if (parsedPrincipal) {
        setActiveAzurePrincipal(parsedPrincipal);
      } else if (activeAzureTenantIdRef.current && activeAzurePrincipalIdRef.current) {
        setActiveAzurePrincipal({
          tenantId: activeAzureTenantIdRef.current,
          principalId: activeAzurePrincipalIdRef.current,
          displayName: activeAzurePrincipalIdRef.current,
          principalName: "",
          principalType: "unknown",
        });
      }
      cacheAzureDeployments(activeAzureTenantIdRef.current, normalizedProjectId, parsedDeployments);
      applyDeployments(parsedDeployments);
    } catch (loadError) {
      const activeRequestSeq =
        target === "playground"
          ? playgroundAzureDeploymentRequestSeqRef.current
          : utilityAzureDeploymentRequestSeqRef.current;
      if (requestSeq !== activeRequestSeq) {
        return;
      }

      logHomeError("load_azure_deployments_failed", loadError, {
        action: "load_azure_deployments",
        context: {
          target,
          projectId: normalizedProjectId,
        },
      });
      const authRequired = loadError instanceof ClientApiError && loadError.kind === "auth_required";
      if (authRequired) {
        clearActiveAzureIdentity();
        clearWorkspaceMcpServerProfilesState();
        clearThreadsState("Azure login is required. Open Settings and sign in to load threads.");
      }
      setIsAzureAuthRequired(authRequired);
      if (target === "playground") {
        setPlaygroundAzureDeployments([]);
        setSelectedPlaygroundAzureDeploymentName("");
        setPlaygroundAzureDeploymentError(
          authRequired
            ? null
            : mapApiError(loadError, "Failed to load deployments for the selected project."),
        );
      } else {
        setUtilityAzureDeployments([]);
        setSelectedUtilityAzureDeploymentName("");
        setUtilityAzureDeploymentError(
          authRequired
            ? null
            : mapApiError(loadError, "Failed to load deployments for the selected project."),
        );
      }
    } finally {
      const activeRequestSeq =
        target === "playground"
          ? playgroundAzureDeploymentRequestSeqRef.current
          : utilityAzureDeploymentRequestSeqRef.current;
      if (requestSeq === activeRequestSeq) {
        if (target === "playground") {
          setIsLoadingPlaygroundAzureDeployments(false);
        } else {
          setIsLoadingUtilityAzureDeployments(false);
        }
      }
    }
  }

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

    const { payload } = await requestClientApi<McpServersApiResponse>({
      url: endpoint,
      init: {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          serializeMcpServerForSave(server, {
            includeId: false,
          }),
        ),
      },
      readPayload: (response) => readJsonPayload<McpServersApiResponse>(response, "saved MCP servers"),
      resolveAuthRequired: (status, responsePayload) =>
        resolveAuthRequired(status, responsePayload, (rawPayload) =>
          isMcpServersAuthRequired(status, rawPayload as McpServersApiResponse),
        ),
      readErrorMessage: (responsePayload) =>
        typeof responsePayload.error === "string" ? responsePayload.error : null,
      fallbackErrorMessage: "Failed to save MCP server.",
      authRequiredMessage: "Azure login is required. Open Settings and sign in to save MCP servers.",
      onAuthRequired: () => {
        setIsAzureAuthRequired(true);
      },
    });

    const profile = readMcpServerFromUnknown(payload.profile);
    if (!profile) {
      throw new Error("Saved MCP server response is invalid.");
    }

    const profiles = readMcpServerList(payload.profiles);
    if (profiles.length > 0) {
      workspaceMcpServerProfilesRef.current = profiles;
      setWorkspaceMcpServerProfiles(profiles);
    } else {
      const nextWorkspaceMcpServerProfiles = upsertMcpServer(
        workspaceMcpServerProfilesRef.current,
        profile,
      );
      workspaceMcpServerProfilesRef.current = nextWorkspaceMcpServerProfiles;
      setWorkspaceMcpServerProfiles(nextWorkspaceMcpServerProfiles);
    }

    return {
      profile,
      warning: typeof payload.warning === "string" ? payload.warning : null,
    };
  }

  async function deleteWorkspaceMcpServerProfileFromConfig(serverId: string): Promise<McpServerConfig[]> {
    const { payload } = await requestClientApi<McpServersApiResponse>({
      url: `/api/mcp/servers/${encodeURIComponent(serverId)}`,
      init: {
        method: "DELETE",
      },
      readPayload: (response) => readJsonPayload<McpServersApiResponse>(response, "saved MCP servers"),
      resolveAuthRequired: (status, responsePayload) =>
        resolveAuthRequired(status, responsePayload, (rawPayload) =>
          isMcpServersAuthRequired(status, rawPayload as McpServersApiResponse),
        ),
      readErrorMessage: (responsePayload) =>
        typeof responsePayload.error === "string" ? responsePayload.error : null,
      fallbackErrorMessage: "Failed to delete MCP server.",
      authRequiredMessage: "Azure login is required. Open Settings and sign in to edit MCP servers.",
      onAuthRequired: () => {
        setIsAzureAuthRequired(true);
      },
    });

    return readMcpServerList(payload.profiles);
  }

  function connectMcpServerToAgent(serverToConnect: McpServerConfig) {
    const activeId = activeThreadIdRef.current.trim();
    if (!activeId) {
      return;
    }

    updateThreadSnapshotById(activeId, (thread) => {
      const existingIndex = thread.mcpServers.findIndex(
        (server) => buildMcpServerKey(server) === buildMcpServerKey(serverToConnect),
      );
      if (existingIndex >= 0) {
        return {
          ...thread,
          mcpServers: thread.mcpServers.map((server, index) =>
            index === existingIndex ? { ...server, name: serverToConnect.name } : server,
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
      isThreadPhaseBlockingSend: isThreadPhaseBlockingSend(threadOperationPhase),
      isChatLocked,
      hasActivePlaygroundAzureConnection: !!activePlaygroundAzureConnection,
      isAzureAuthRequired,
      isLoadingPlaygroundAzureDeployments,
      deploymentName,
      isSelectedDeploymentValid: includesAzureDeploymentName(playgroundAzureDeployments, deploymentName),
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
      if (preconditionViolation.type === "thread_error" && preconditionViolation.message) {
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

    if (!content || !threadId || !activePlaygroundAzureConnection || !deploymentName) {
      return;
    }

    const baseThread = findThreadSnapshotById(threadsRef.current, threadId);
    const shouldRefreshThreadTitleOnFirstMessage =
      !!baseThread && baseThread.deletedAt === null && baseThread.messages.length === 0;

    const turnId = createId("turn");
    const requestAttachments = draftAttachments.map(
      ({ id: _id, ...attachment }) => attachment,
    );
    const requestMcpServers = cloneMcpServers(mcpServers);
    const requestMessageSkillActivations = cloneThreadSkillActivations(selectedMessageSkillActivations);
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
    const history = messages
      .map(({ role, content: previousContent, attachments }) => {
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
      });

    appendMessageToThreadState(threadId, userMessage);
    setDraft("");
    setSelectedMessageSkillActivations([]);
    setDraftAttachments([]);
    setChatAttachmentError(null);
    setUiError(null);
    setSystemNotice(null);
    setAzureLoginError(null);
    updateThreadRequestState(threadId, (current) =>
      applySendResult(current, {
        status: "optimistic",
        turnId,
      }),
    );
    logHomeInfo("send_message_started", "Thread message request started.", {
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

      const { payload, isEventStream, operationLogCount } = await consumeChatResponseStream({
        response,
        readChatEventStreamPayload: (streamResponse, handlers) =>
          readChatEventStreamPayload(streamResponse, handlers),
        readJsonPayload: (jsonResponse) => readJsonPayload<ChatApiResponse>(jsonResponse, "chat"),
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
          setIsAzureAuthRequired(true);
        }
        throw new Error(payload.error || "Failed to send message.");
      }

      if (!payload.message) {
        throw new Error("The server returned an empty message.");
      }

      applyThreadEnvironmentToThreadState(
        threadId,
        "threadEnvironment" in payload ? payload.threadEnvironment : requestThreadEnvironment,
      );
      const assistantMessage = createThreadMessage("assistant", payload.message, turnId);
      appendMessageToThreadState(threadId, assistantMessage);
      updateThreadRequestState(threadId, (current) =>
        applySendResult(current, {
          status: "succeeded",
        }),
      );
      logHomeInfo("send_message_succeeded", "Thread message request completed.", {
        action: "send_message",
        context: {
          threadId,
          turnId,
          responseLength: payload.message.length,
          operationLogCount,
          usedEventStream: isEventStream,
        },
      });
    } catch (sendError) {
      const wasCanceled = sendAbortController.signal.aborted;
      if (wasCanceled) {
        logHomeInfo("send_message_canceled", "Thread message request canceled.", {
          action: "send_message_cancel",
          context: {
            threadId,
            turnId,
          },
        });
        updateThreadRequestState(threadId, (current) =>
          applySendResult(current, {
            status: "canceled",
          }),
        );
        return;
      }

      logHomeError("send_message_failed", sendError, {
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
        void saveThreadSnapshotSilentlyIfNeeded(threadId);
      }, 0);
    }
  }

  // UI event handlers bound to panel props.
  async function runAzureLoginFlow(targetTenantIdRaw = ""): Promise<LoadAzureProjectsResult> {
    const targetTenantId = targetTenantIdRaw.trim();
    const waitForWorkspaceStateReload = targetTenantId.length > 0;
    const requestInit: RequestInit = {
      method: "PUT",
    };
    if (targetTenantId) {
      requestInit.headers = {
        "Content-Type": "application/json",
      };
      requestInit.body = JSON.stringify({
        tenantId: targetTenantId,
      });
    }

    const response = await fetch("/api/azure/session", requestInit);
    const payload = (await response.json()) as AzureActionApiResponse;
    if (!response.ok) {
      throw new Error(payload.error || "Failed to start Azure login.");
    }

    setSystemNotice(
      targetTenantId
        ? "Azure tenant switched. Azure projects were refreshed."
        : payload.message || "Azure login completed.",
    );
    setIsAzureAuthRequired((currentAuthRequired) =>
      resolveAzureAuthRequiredState({
        currentAuthRequired,
        nextAuthRequired: false,
        source: "interactive_login",
      }),
    );
    setAzureConnectionError(null);
    setPlaygroundAzureDeploymentError(null);
    setUtilityAzureDeploymentError(null);

    let loadResult: LoadAzureProjectsResult = {
      authRequired: true,
      tenantSwitchPending: false,
    };
    for (let attempt = 0; attempt < 6; attempt += 1) {
      loadResult = await loadAzureProjects(
        targetTenantId
          ? {
              preferredTenantId: targetTenantId,
              force: true,
              waitForWorkspaceStateReload,
            }
          : {
              preferredTenantId: targetTenantId,
              waitForWorkspaceStateReload,
            },
      );
      if (isAzureProjectsLoadReady(loadResult)) {
        break;
      }

      await new Promise((resolve) => {
        window.setTimeout(resolve, 500);
      });
    }
    if (loadResult.authRequired) {
      setIsAzureAuthRequired(true);
    }

    return loadResult;
  }

  async function handleAzureLogin() {
    if (isStartingAzureLogin || isSwitchingAzureTenant) {
      return;
    }

    setAzureLoginError(null);
    setAzureTenantSwitchError(null);
    setSystemNotice(null);
    setIsStartingAzureLogin(true);
    try {
      await runAzureLoginFlow();
    } catch (loginError) {
      logHomeError("azure_login_flow_failed", loginError, {
        action: "azure_login",
      });
      setAzureLoginError(
        loginError instanceof Error ? loginError.message : "Failed to start Azure login.",
      );
    } finally {
      setIsStartingAzureLogin(false);
    }
  }

  async function handleAzureTenantChange(nextTenantIdRaw: string) {
    if (
      isAzureAuthRequired ||
      isStartingAzureLogin ||
      isSwitchingAzureTenant ||
      isStartingAzureLogout
    ) {
      return;
    }

    const nextTenantId = nextTenantIdRaw.trim();
    const activeTenantId = activeAzureTenantIdRef.current.trim();
    if (!nextTenantId || nextTenantId === activeTenantId) {
      return;
    }

    setAzureTenantSwitchError(null);
    setAzureLoginError(null);
    setSystemNotice(null);
    setIsSwitchingAzureTenant(true);

    try {
      const loadResult = await runAzureLoginFlow(nextTenantId);
      if (loadResult.tenantSwitchPending) {
        setAzureTenantSwitchError(
          "Azure tenant switch is still applying. Retry Azure Login if this persists.",
        );
      } else if (loadResult.authRequired) {
        setAzureTenantSwitchError("Failed to switch Azure tenant. Retry Azure Login.");
      }
    } catch (switchError) {
      logHomeError("azure_tenant_switch_failed", switchError, {
        action: "azure_tenant_switch",
        context: {
          tenantId: nextTenantId,
        },
      });
      setAzureTenantSwitchError(
        switchError instanceof Error ? switchError.message : "Failed to switch Azure tenant.",
      );
    } finally {
      setIsSwitchingAzureTenant(false);
    }
  }

  async function handleAzureLogout() {
    if (isStartingAzureLogout || isSwitchingAzureTenant) {
      return;
    }

    setAzureLogoutError(null);
    setAzureTenantSwitchError(null);
    setSystemNotice(null);
    setIsStartingAzureLogout(true);
    try {
      const response = await fetch("/api/azure/session", {
        method: "DELETE",
      });
      const payload = (await response.json()) as AzureActionApiResponse;
      if (!response.ok) {
        throw new Error(payload.error || "Failed to run Azure logout.");
      }

      setSystemNotice(payload.message || "Azure logout completed.");
      setPlaygroundAzureDeploymentError(null);
      setUtilityAzureDeploymentError(null);
      await loadAzureProjects({ force: true });
    } catch (logoutError) {
      logHomeError("azure_logout_flow_failed", logoutError, {
        action: "azure_logout",
      });
      setAzureLogoutError(
        logoutError instanceof Error ? logoutError.message : "Failed to run Azure logout.",
      );
    } finally {
      setIsStartingAzureLogout(false);
    }
  }

  async function handleReloadAzureCatalog() {
    if (
      isAzureAuthRequired ||
      isReloadingAzureCatalog ||
      isStartingAzureLogin ||
      isSwitchingAzureTenant ||
      isStartingAzureLogout ||
      isLoadingAzureConnections ||
      isLoadingPlaygroundAzureDeployments ||
      isLoadingUtilityAzureDeployments
    ) {
      return;
    }

    setAzureConnectionError(null);
    setPlaygroundAzureDeploymentError(null);
    setUtilityAzureDeploymentError(null);
    setAzureTenantSwitchError(null);
    setAzureLoginError(null);
    setSystemNotice(null);
    setIsReloadingAzureCatalog(true);

    try {
      clearAzureCatalogCacheByTenant(activeAzureTenantIdRef.current);
      const loadResult = await loadAzureProjects({ force: true });
      if (isAzureProjectsLoadReady(loadResult)) {
        setSystemNotice("Azure catalog reloaded.");
      }
    } finally {
      setIsReloadingAzureCatalog(false);
    }
  }

  function handleReloadWorkspaceMcpServerProfiles() {
    setWorkspaceMcpServerProfileError(null);
    void loadWorkspaceMcpServerProfiles();
  }

  function handleCancelMcpServerEdit() {
    clearMcpServerEditState();
    setWorkspaceMcpServerProfileError(null);
  }

  function handleEditWorkspaceMcpServerProfile(serverIdRaw: string) {
    if (isArchivedThread(activeThreadIdRef.current)) {
      setWorkspaceMcpServerProfileError("Archived thread is read-only. Restore it from Archives to edit MCP servers.");
      return;
    }

    const serverId = serverIdRaw.trim();
    if (!serverId) {
      return;
    }

    const selected = workspaceMcpServerProfiles.find((server) => server.id === serverId);
    if (!selected) {
      setWorkspaceMcpServerProfileError("Selected MCP server is not available.");
      return;
    }

    setEditingMcpServerId(serverId);
    populateMcpServerFormForEdit(selected);
    setMcpFormError(null);
    setMcpFormWarning(null);
    setWorkspaceMcpServerProfileError(null);
  }

  async function handleDeleteWorkspaceMcpServerProfile(serverIdRaw: string) {
    if (isArchivedThread(activeThreadIdRef.current)) {
      setWorkspaceMcpServerProfileError("Archived thread is read-only. Restore it from Archives to edit MCP servers.");
      return;
    }

    if (isDeletingWorkspaceMcpServerProfile) {
      return;
    }

    const serverId = serverIdRaw.trim();
    if (!serverId) {
      return;
    }

    const selected = workspaceMcpServerProfiles.find((server) => server.id === serverId);
    if (!selected) {
      setWorkspaceMcpServerProfileError("Selected MCP server is not available.");
      return;
    }

    setIsDeletingWorkspaceMcpServerProfile(true);
    setWorkspaceMcpServerProfileError(null);

    try {
      const nextWorkspaceMcpServerProfiles = await deleteWorkspaceMcpServerProfileFromConfig(serverId);
      workspaceMcpServerProfilesRef.current = nextWorkspaceMcpServerProfiles;
      setWorkspaceMcpServerProfiles(nextWorkspaceMcpServerProfiles);

      const deletedKey = buildMcpServerKey(selected);
      const activeId = activeThreadIdRef.current.trim();
      if (activeId) {
        updateThreadSnapshotById(activeId, (thread) => ({
          ...thread,
          mcpServers: thread.mcpServers.filter(
            (server) => buildMcpServerKey(server) !== deletedKey,
          ),
        }));
      }

      if (editingMcpServerId === serverId) {
        clearMcpServerEditState();
      }
    } catch (deleteError) {
      logHomeError("delete_mcp_server_failed", deleteError, {
        action: "delete_saved_mcp_server",
        context: {
          serverId,
          serverName: selected.name,
        },
      });
      setWorkspaceMcpServerProfileError(
        deleteError instanceof Error ? deleteError.message : "Failed to delete MCP server.",
      );
    } finally {
      setIsDeletingWorkspaceMcpServerProfile(false);
    }
  }

  function handleReloadSkills() {
    const now = Date.now();
    if (now - lastManualSkillsReloadAtRef.current < HOME_SKILLS_RELOAD_MIN_INTERVAL_MS) {
      return;
    }
    lastManualSkillsReloadAtRef.current = now;
    void loadAvailableSkills({
      forceRefresh: true,
    });
  }

  function handleToggleRegistrySkill(registryId: SkillRegistryId, skillIdRaw: string) {
    const skillId = skillIdRaw.trim();
    if (!skillId) {
      return;
    }

    const registryCatalog = skillRegistryCatalogs.find(
      (registry) => registry.registryId === registryId,
    );
    if (!registryCatalog) {
      return;
    }

    const selectedSkill = registryCatalog.skills.find((skill) => skill.id === skillId);
    if (!selectedSkill) {
      return;
    }

    void updateSkillRegistrySkill({
      action:
        selectedSkill.isInstalled && !selectedSkill.isUpdateAvailable
          ? "delete_registry_skill"
          : "install_registry_skill",
      registryId: registryCatalog.registryId,
      skillName: selectedSkill.id,
    });
  }

  function handleAddMessageSkillActivation(locationRaw: string) {
    const location = locationRaw.trim();
    if (!location) {
      return;
    }

    setSelectedMessageSkillActivations((current) => {
      if (current.some((selection) => selection.location === location)) {
        return current;
      }

      const skill = availableSkillByLocation.get(location);
      if (!skill) {
        return current;
      }

      return [
        ...current,
        {
          name: skill.name,
          location: skill.location,
        },
      ];
    });
  }

  function handleRemoveMessageSkillActivation(locationRaw: string) {
    const location = locationRaw.trim();
    if (!location) {
      return;
    }

    setSelectedMessageSkillActivations((current) =>
      current.filter((selection) => selection.location !== location),
    );
  }

  function handleAddThreadSkill(locationRaw: string) {
    const location = locationRaw.trim();
    if (!location) {
      return;
    }

    const skill = availableSkillByLocation.get(location);
    if (!skill) {
      return;
    }

    const activeId = activeThreadIdRef.current.trim();
    if (!activeId) {
      return;
    }
    updateThreadSnapshotById(activeId, (thread) => {
      if (thread.skillSelections.some((selection) => selection.location === location)) {
        return thread;
      }

      return {
        ...thread,
        skillSelections: [
          ...thread.skillSelections,
          {
            name: skill.name,
            location: skill.location,
          },
        ],
      };
    });
    setSkillsError(null);
  }

  function handleRemoveThreadSkill(locationRaw: string) {
    const location = locationRaw.trim();
    if (!location) {
      return;
    }
    const activeId = activeThreadIdRef.current.trim();
    if (!activeId) {
      return;
    }
    updateThreadSnapshotById(activeId, (thread) => ({
      ...thread,
      skillSelections: thread.skillSelections.filter(
        (selection) => selection.location !== location,
      ),
    }));
    setSkillsError(null);
  }

  function handleToggleThreadSkill(locationRaw: string) {
    const location = locationRaw.trim();
    if (!location) {
      return;
    }
    const activeId = activeThreadIdRef.current.trim();
    if (!activeId) {
      return;
    }
    updateThreadSnapshotById(activeId, (thread) => {
      const existingIndex = thread.skillSelections.findIndex(
        (selection) => selection.location === location,
      );
      if (existingIndex >= 0) {
        return {
          ...thread,
          skillSelections: thread.skillSelections.filter(
            (selection) => selection.location !== location,
          ),
        };
      }

      const skill = availableSkillByLocation.get(location);
      if (!skill) {
        return thread;
      }

      return {
        ...thread,
        skillSelections: [
          ...thread.skillSelections,
          {
            name: skill.name,
            location: skill.location,
          },
        ],
      };
    });
    setSkillsError(null);
  }

  function handleSelectActiveChatCommandSuggestion(suggestionIdRaw: string) {
    const suggestionId = suggestionIdRaw.trim();
    if (!suggestionId || !activeChatCommandMatch || !activeChatCommandProvider) {
      return;
    }

    const suggestion =
      activeChatCommandSuggestions.find((entry) => entry.id === suggestionId) ?? null;
    if (!suggestion || !suggestion.isAvailable) {
      return;
    }

    activeChatCommandProvider.applySuggestion(suggestion);

    const nextDraft = replaceChatCommandToken({
      value: draft,
      rangeStart: activeChatCommandMatch.rangeStart,
      rangeEnd: activeChatCommandMatch.rangeEnd,
      replacement: "",
    });
    pendingChatCommandCursorIndexRef.current = nextDraft.cursorIndex;
    setDraft(nextDraft.value);
    setChatComposerCursorIndex(nextDraft.cursorIndex);
    setChatCommandHighlightedIndex(0);
    setChatAttachmentError(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isArchivedThread(activeThreadIdRef.current)) {
      setThreadError("Archived thread is read-only. Restore it from Archives to continue.");
      setActiveMainTab("threads");
      return;
    }
    if (isChatLocked) {
      setActiveMainTab("settings");
      return;
    }
    void sendMessage();
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing || isComposing || event.nativeEvent.keyCode === 229) {
      return;
    }

    if (activeChatCommandMenu && activeChatCommandMenu.suggestions.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setChatCommandHighlightedIndex((current) => {
          const total = activeChatCommandMenu.suggestions.length;
          if (total <= 0) {
            return 0;
          }

          return (current + 1) % total;
        });
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setChatCommandHighlightedIndex((current) => {
          const total = activeChatCommandMenu.suggestions.length;
          if (total <= 0) {
            return 0;
          }

          return (current - 1 + total) % total;
        });
        return;
      }

      if (event.key === "Enter" && !event.shiftKey) {
        const activeSuggestion = activeChatCommandMenu.suggestions[activeChatCommandHighlightIndex];
        if (!activeSuggestion) {
          return;
        }

        event.preventDefault();
        handleSelectActiveChatCommandSuggestion(activeSuggestion.id);
        return;
      }
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (isArchivedThread(activeThreadIdRef.current)) {
        setThreadError("Archived thread is read-only. Restore it from Archives to continue.");
        setActiveMainTab("threads");
        return;
      }
      if (isChatLocked) {
        setActiveMainTab("settings");
        return;
      }
      void sendMessage();
    }
  }

  function handleDraftChange(event: React.ChangeEvent<HTMLTextAreaElement>, value: string) {
    if (isArchivedThread(activeThreadIdRef.current)) {
      return;
    }

    const cursorIndex = event.currentTarget.selectionStart ?? value.length;
    setDraft(value);
    setChatComposerCursorIndex(cursorIndex);
    setChatAttachmentError(null);
    resizeChatInput(event.currentTarget);
  }

  function handleInputSelect(event: SyntheticEvent<HTMLTextAreaElement>) {
    const target = event.currentTarget;
    setChatComposerCursorIndex(target.selectionStart ?? target.value.length);
  }

  function handleOpenChatAttachmentPicker() {
    if (isSending || isChatLocked || isArchivedThread(activeThreadIdRef.current)) {
      return;
    }

    chatAttachmentInputRef.current?.click();
  }

  async function handleChatAttachmentFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const input = event.currentTarget;
    if (isArchivedThread(activeThreadIdRef.current)) {
      input.value = "";
      return;
    }
    const selectedFiles = input.files ? Array.from(input.files) : [];
    if (selectedFiles.length === 0) {
      input.value = "";
      return;
    }

    setChatAttachmentError(null);

    const availableSlots = CHAT_ATTACHMENT_MAX_FILES - draftAttachments.length;
    if (availableSlots <= 0) {
      setChatAttachmentError(`You can attach up to ${CHAT_ATTACHMENT_MAX_FILES} files.`);
      input.value = "";
      return;
    }

    const filesToProcess = selectedFiles.slice(0, availableSlots);
    const nextAttachments: DraftChatAttachment[] = [];
    let nextTotalSize = draftAttachmentTotalSizeBytes;
    let nextPdfTotalSize = draftPdfAttachmentTotalSizeBytes;
    let validationError: string | null = null;

    for (const file of filesToProcess) {
      const normalizedName = file.name.trim() || "attachment";
      if (normalizedName.length > CHAT_ATTACHMENT_MAX_FILE_NAME_LENGTH) {
        validationError = `Attachment file names must be ${CHAT_ATTACHMENT_MAX_FILE_NAME_LENGTH} characters or fewer.`;
        break;
      }

      const extension = getFileExtension(normalizedName);
      if (!CHAT_ATTACHMENT_ALLOWED_EXTENSIONS.has(extension)) {
        validationError = `Attachment "${normalizedName}" is not supported. Only ${chatAttachmentFormatHint} files can be attached.`;
        break;
      }

      const normalizedMimeType = file.type.trim().toLowerCase();

      if (file.size <= 0) {
        validationError = `Attachment "${normalizedName}" is empty.`;
        break;
      }

      const maxFileSizeBytes =
        extension === "pdf"
          ? CHAT_ATTACHMENT_MAX_PDF_FILE_SIZE_BYTES
          : CHAT_ATTACHMENT_MAX_NON_PDF_FILE_SIZE_BYTES;
      if (file.size > maxFileSizeBytes) {
        validationError = `Attachment "${normalizedName}" is too large. Max size is ${formatChatAttachmentSize(maxFileSizeBytes)} for .${extension} files.`;
        break;
      }

      if (nextTotalSize + file.size > CHAT_ATTACHMENT_MAX_TOTAL_SIZE_BYTES) {
        validationError = `Total attachment size cannot exceed ${formatChatAttachmentSize(CHAT_ATTACHMENT_MAX_TOTAL_SIZE_BYTES)}.`;
        break;
      }
      if (
        extension === "pdf" &&
        nextPdfTotalSize + file.size > CHAT_ATTACHMENT_MAX_PDF_TOTAL_SIZE_BYTES
      ) {
        validationError = `Total PDF attachment size cannot exceed ${formatChatAttachmentSize(CHAT_ATTACHMENT_MAX_PDF_TOTAL_SIZE_BYTES)}.`;
        break;
      }

      try {
        const dataUrl = await readFileAsDataUrl(file);
        nextAttachments.push({
          id: createId("attachment"),
          name: normalizedName,
          mimeType: normalizedMimeType || "application/octet-stream",
          sizeBytes: file.size,
          dataUrl,
        });
        nextTotalSize += file.size;
        if (extension === "pdf") {
          nextPdfTotalSize += file.size;
        }
      } catch (readAttachmentError) {
        logHomeError("read_attachment_failed", readAttachmentError, {
          action: "read_chat_attachment",
          context: {
            fileName: normalizedName,
            fileSize: file.size,
          },
        });
        validationError = `Failed to read "${normalizedName}".`;
        break;
      }
    }

    if (!validationError && selectedFiles.length > filesToProcess.length) {
      validationError = `You can attach up to ${CHAT_ATTACHMENT_MAX_FILES} files.`;
    }

    if (nextAttachments.length > 0) {
      setDraftAttachments((current) => [...current, ...nextAttachments]);
    }

    setChatAttachmentError(validationError);
    input.value = "";
  }

  function handleRemoveDraftAttachment(id: string) {
    if (isArchivedThread(activeThreadIdRef.current)) {
      return;
    }

    setDraftAttachments((current) => current.filter((attachment) => attachment.id !== id));
    setChatAttachmentError(null);
  }

  function resizeChatInput(input: HTMLTextAreaElement) {
    input.style.height = "auto";
    const boundedHeight = Math.max(
      HOME_CHAT_INPUT_MIN_HEIGHT_PX,
      Math.min(input.scrollHeight, HOME_CHAT_INPUT_MAX_HEIGHT_PX),
    );
    input.style.height = `${boundedHeight}px`;
    input.style.overflowY = input.scrollHeight > HOME_CHAT_INPUT_MAX_HEIGHT_PX ? "auto" : "hidden";
  }

  function handleChatProjectChange(projectId: string) {
    setSelectedPlaygroundAzureConnectionId(projectId);
    setSelectedPlaygroundAzureDeploymentName("");
    setPlaygroundAzureDeploymentError(null);
    setUiError(null);
  }

  function handleChatDeploymentChange(nextDeploymentNameRaw: string) {
    const nextDeploymentName = nextDeploymentNameRaw.trim();
    setSelectedPlaygroundAzureDeploymentName(nextDeploymentName);
    setUiError(null);

    const tenantId = activeAzureTenantIdRef.current.trim();
    const principalId = activeAzurePrincipalIdRef.current.trim();
    const projectId = (activePlaygroundAzureConnection?.id ?? "").trim();
    if (!tenantId || !principalId || !projectId || !nextDeploymentName) {
      return;
    }

    if (!includesAzureDeploymentName(playgroundAzureDeployments, nextDeploymentName)) {
      return;
    }

    void saveAzureSelectionPreference({
      target: "playground",
      tenantId,
      principalId,
      projectId,
      deploymentName: nextDeploymentName,
    });
  }

  function handleUtilityProjectChange(projectId: string) {
    setSelectedUtilityAzureConnectionId(projectId);
    setSelectedUtilityAzureDeploymentName("");
    setUtilityAzureDeploymentError(null);
    setInstructionEnhanceError(null);
  }

  function handleUtilityDeploymentChange(nextDeploymentNameRaw: string) {
    const nextDeploymentName = nextDeploymentNameRaw.trim();
    setSelectedUtilityAzureDeploymentName(nextDeploymentName);
    setInstructionEnhanceError(null);

    const tenantId = activeAzureTenantIdRef.current.trim();
    const principalId = activeAzurePrincipalIdRef.current.trim();
    const projectId = (activeUtilityAzureConnection?.id ?? "").trim();
    if (!tenantId || !principalId || !projectId || !nextDeploymentName) {
      return;
    }

    if (!includesAzureDeploymentName(utilityAzureDeployments, nextDeploymentName)) {
      return;
    }

    void saveAzureSelectionPreference({
      target: "utility",
      tenantId,
      principalId,
      projectId,
      deploymentName: nextDeploymentName,
      reasoningEffort: effectiveUtilityReasoningEffort,
    });
  }

  function handleUtilityReasoningEffortChange(nextValue: ReasoningEffort) {
    if (!isUtilityReasoningEffortSupported) {
      return;
    }
    if (!effectiveUtilityReasoningEffortOptions.includes(nextValue)) {
      return;
    }
    setUtilityReasoningEffort(nextValue);
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

  function handleInstructionContextToggleChange(
    toggleKey: ThreadInstructionContextToggleKey,
    nextValue: boolean,
  ) {
    if (isArchivedThread(activeThreadIdRef.current)) {
      return;
    }

    setInstructionContextToggles((current) => ({
      ...current,
      [toggleKey]: nextValue,
    }));
    setInstructionSaveError(null);
    setInstructionSaveSuccess(null);
    setInstructionEnhanceError(null);
    setInstructionEnhanceSuccess(null);
    setInstructionEnhanceComparison(null);
  }

  function handleAgentInstructionChange(value: string) {
    if (isArchivedThread(activeThreadIdRef.current)) {
      return;
    }

    setAgentInstruction(value);
    setInstructionSaveError(null);
    setInstructionSaveSuccess(null);
    setInstructionEnhanceError(null);
    setInstructionEnhanceSuccess(null);
    setInstructionEnhanceComparison(null);
  }

  function handleClearInstruction() {
    if (isArchivedThread(activeThreadIdRef.current)) {
      return;
    }

    setAgentInstruction("");
    setLoadedInstructionFileName(null);
    setInstructionFileError(null);
    setInstructionSaveError(null);
    setInstructionSaveSuccess(null);
    setInstructionEnhanceError(null);
    setInstructionEnhanceSuccess(null);
    setInstructionEnhanceComparison(null);
  }

  async function handleInstructionFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const input = event.currentTarget;
    if (isArchivedThread(activeThreadIdRef.current)) {
      input.value = "";
      return;
    }
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    setInstructionFileError(null);

    const extension = getFileExtension(file.name);
    if (!INSTRUCTION_ALLOWED_EXTENSIONS.has(extension)) {
      setInstructionFileError("Only .md, .txt, .xml, and .json files are supported.");
      input.value = "";
      return;
    }

    if (file.size > INSTRUCTION_MAX_FILE_SIZE_BYTES) {
      setInstructionFileError(
        `Instruction file is too large. Max ${INSTRUCTION_MAX_FILE_SIZE_LABEL}.`,
      );
      input.value = "";
      return;
    }

    try {
      const text = await file.text();
      setAgentInstruction(text);
      setLoadedInstructionFileName(file.name);
      setInstructionSaveError(null);
      setInstructionSaveSuccess(null);
      setInstructionEnhanceError(null);
      setInstructionEnhanceSuccess(null);
      setInstructionEnhanceComparison(null);
    } catch (readInstructionError) {
      logHomeError("read_instruction_file_failed", readInstructionError, {
        action: "load_instruction_file",
        context: {
          fileName: file.name,
          fileSize: file.size,
        },
      });
      setInstructionFileError("Failed to read the selected instruction file.");
    } finally {
      input.value = "";
    }
  }

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
      const sourceFileName = resolveInstructionSourceFileName(loadedInstructionFileName);
      const suggestedFileName = buildInstructionSuggestedFileName(
        sourceFileName,
        agentInstruction,
      );
      const saveResult = await saveInstructionToClientFile(agentInstruction, suggestedFileName);
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
      logHomeError("save_instruction_file_failed", saveError, {
        action: "save_instruction_file",
      });
      setInstructionSaveError(
        saveError instanceof Error ? saveError.message : "Failed to save instruction prompt.",
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
      setInstructionEnhanceError("Utility deployment list is loading. Please wait.");
      return;
    }

    if (!deploymentName || !includesAzureDeploymentName(utilityAzureDeployments, deploymentName)) {
      setInstructionEnhanceError("Select a Utility deployment before enhancing.");
      return;
    }

    const sourceFileName = resolveInstructionSourceFileName(loadedInstructionFileName);
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
          setIsAzureAuthRequired(true);
        }

        throw new Error(payload.error || "Failed to enhance instruction.");
      }

      const rawInstructionPatch =
        typeof payload.message === "string" ? payload.message : "";
      const normalizedInstructionPatch = normalizeInstructionDiffPatchResponse(
        rawInstructionPatch,
      );
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
      setInstructionEnhanceSuccess("Review the diff and choose which version to adopt.");
    } catch (enhanceError) {
      logHomeError("enhance_instruction_failed", enhanceError, {
        action: "enhance_instruction",
      });
      setInstructionEnhanceError(
        enhanceError instanceof Error ? enhanceError.message : "Failed to enhance instruction.",
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

  async function handleAddMcpServer() {
    if (isArchivedThread(activeThreadIdRef.current)) {
      setMcpFormError("Archived thread is read-only. Restore it from Archives to edit MCP servers.");
      return;
    }

    const editingServerId = editingMcpServerId.trim();
    const isEditing = editingServerId.length > 0;
    const editingServer = isEditing
      ? workspaceMcpServerProfiles.find((server) => server.id === editingServerId) ?? null
      : null;
    if (isEditing && !editingServer) {
      setEditingMcpServerId("");
      setMcpFormError("Selected MCP server is not available.");
      return;
    }

    const rawName = mcpNameInput.trim();
    setMcpFormError(null);
    setMcpFormWarning(null);

    let serverToSave: McpServerConfig;
    const serverId = isEditing ? editingServerId : createId("mcp");

    if (mcpTransport === "stdio") {
      const command = mcpCommandInput.trim();
      if (!command) {
        setMcpFormError("MCP stdio command is required.");
        return;
      }

      if (/\s/.test(command)) {
        setMcpFormError("MCP stdio command must not include spaces.");
        return;
      }

      const argsResult = parseStdioArgsInput(mcpArgsInput);
      if (!argsResult.ok) {
        setMcpFormError(argsResult.error);
        return;
      }

      const envResult = parseStdioEnvInput(mcpEnvInput);
      if (!envResult.ok) {
        setMcpFormError(envResult.error);
        return;
      }

      const cwd = mcpCwdInput.trim();
      const name = rawName || command;

      serverToSave = {
        name,
        transport: "stdio",
        command,
        args: argsResult.value,
        cwd: cwd || undefined,
        env: envResult.value,
        id: serverId,
      };
    } else {
      const rawUrl = mcpUrlInput.trim();
      if (!rawUrl) {
        setMcpFormError("MCP server URL is required.");
        return;
      }

      let parsed: URL;
      try {
        parsed = new URL(rawUrl);
      } catch {
        setMcpFormError("MCP server URL is invalid.");
        return;
      }

      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        setMcpFormError("MCP server URL must start with http:// or https://.");
        return;
      }

      const name = rawName || parsed.hostname;
      if (!name) {
        setMcpFormError("MCP server name is required.");
        return;
      }

      const normalizedUrl = parsed.toString();
      const headersResult = parseHttpHeadersInput(mcpHeadersInput);
      if (!headersResult.ok) {
        setMcpFormError(headersResult.error);
        return;
      }

      let azureAuthScope = MCP_DEFAULT_AZURE_AUTH_SCOPE;
      if (mcpUseAzureAuthInput) {
        const scopeResult = parseAzureAuthScopeInput(mcpAzureAuthScopeInput);
        if (!scopeResult.ok) {
          setMcpFormError(scopeResult.error);
          return;
        }
        azureAuthScope = scopeResult.value;
      }
      const timeoutResult = parseMcpTimeoutSecondsInput(mcpTimeoutSecondsInput);
      if (!timeoutResult.ok) {
        setMcpFormError(timeoutResult.error);
        return;
      }

      serverToSave = {
        id: serverId,
        name,
        url: normalizedUrl,
        transport: mcpTransport,
        headers: headersResult.value,
        useAzureAuth: mcpUseAzureAuthInput,
        azureAuthScope,
        timeoutSeconds: timeoutResult.value,
      };
    }

    const existingServerIndex = isEditing
      ? -1
      : mcpServers.findIndex(
          (server) => buildMcpServerKey(server) === buildMcpServerKey(serverToSave),
        );
    const existingServerName = existingServerIndex >= 0 ? (mcpServers[existingServerIndex]?.name ?? "") : "";

    setIsSavingMcpServer(true);
    let saveWarning: string | null = null;
    let savedProfile = serverToSave;
    try {
      const saveResult = await saveMcpServerToConfig(serverToSave, {
        isUpdate: isEditing,
      });
      saveWarning = saveResult.warning;
      savedProfile = saveResult.profile;

      if (isEditing && editingServer) {
        const previousServerKey = buildMcpServerKey(editingServer);
        const nextServerKey = buildMcpServerKey(savedProfile);
        const activeId = activeThreadIdRef.current.trim();
        if (activeId) {
          updateThreadSnapshotById(activeId, (thread) => {
            const filtered = thread.mcpServers.filter(
              (server) => buildMcpServerKey(server) !== previousServerKey,
            );
            if (filtered.length === thread.mcpServers.length) {
              return thread;
            }

            const nextIndex = filtered.findIndex(
              (server) => buildMcpServerKey(server) === nextServerKey,
            );
            if (nextIndex >= 0) {
              return {
                ...thread,
                mcpServers: filtered.map((server, index) =>
                  index === nextIndex ? { ...server, name: savedProfile.name } : server,
                ),
              };
            }

            return {
              ...thread,
              mcpServers: [...filtered, savedProfile],
            };
          });
        }
      } else {
        connectMcpServerToAgent(savedProfile);
      }

      setWorkspaceMcpServerProfileError(null);
    } catch (saveError) {
      logHomeError("save_mcp_server_failed", saveError, {
        action: "save_mcp_server",
      });
      setMcpFormError(saveError instanceof Error ? saveError.message : "Failed to save MCP server.");
      return;
    } finally {
      setIsSavingMcpServer(false);
    }

    setMcpFormError(null);
    if (isEditing) {
      setMcpFormWarning(saveWarning);
      if (saveWarning) {
        logHomeWarning("mcp_server_edit_warning", saveWarning, {
          action: "save_mcp_server",
          context: {
            savedProfileName: savedProfile.name,
            transport: savedProfile.transport,
          },
        });
      }
    } else if (existingServerIndex >= 0) {
      const fallbackLocalWarning =
        existingServerName && existingServerName !== savedProfile.name
          ? `An MCP server with the same configuration already exists. Renamed it from "${existingServerName}" to "${savedProfile.name}".`
          : "An MCP server with the same configuration already exists. Reused the existing entry.";
      const warningToShow = saveWarning ?? fallbackLocalWarning;
      setMcpFormWarning(warningToShow);
      logHomeWarning("mcp_server_duplicate_warning", warningToShow, {
        action: "save_mcp_server",
        context: {
          existingServerName,
          savedProfileName: savedProfile.name,
          transport: serverToSave.transport,
        },
      });
    } else {
      setMcpFormWarning(saveWarning);
      if (saveWarning) {
        logHomeWarning("mcp_server_save_warning", saveWarning, {
          action: "save_mcp_server",
          context: {
            savedProfileName: savedProfile.name,
            transport: serverToSave.transport,
          },
        });
      }
    }
    setEditingMcpServerId("");
    resetMcpServerFormInputs();
  }

  function handleToggleWorkspaceMcpServerProfile(serverIdRaw: string) {
    if (isArchivedThread(activeThreadIdRef.current)) {
      setWorkspaceMcpServerProfileError("Archived thread is read-only. Restore it from Archives to edit MCP servers.");
      return;
    }

    const serverId = serverIdRaw.trim();
    if (!serverId) {
      return;
    }

    const selected = workspaceMcpServerProfiles.find((server) => server.id === serverId);
    if (!selected) {
      setWorkspaceMcpServerProfileError("Selected MCP server is not available.");
      return;
    }

    const selectedKey = buildMcpServerKey(selected);
    const activeId = activeThreadIdRef.current.trim();
    if (!activeId) {
      return;
    }
    updateThreadSnapshotById(activeId, (thread) => {
      const alreadyConnected = thread.mcpServers.some(
        (server) => buildMcpServerKey(server) === selectedKey,
      );
      if (alreadyConnected) {
        return {
          ...thread,
          mcpServers: thread.mcpServers.filter(
            (server) => buildMcpServerKey(server) !== selectedKey,
          ),
        };
      }

      return {
        ...thread,
        mcpServers: [...thread.mcpServers, selected],
      };
    });
    setWorkspaceMcpServerProfileError(null);
  }

  function handleRemoveMcpServer(id: string) {
    if (isArchivedThread(activeThreadIdRef.current)) {
      return;
    }
    const activeId = activeThreadIdRef.current.trim();
    if (!activeId) {
      return;
    }
    updateThreadSnapshotById(activeId, (thread) => ({
      ...thread,
      mcpServers: thread.mcpServers.filter((server) => server.id !== id),
    }));
  }

  async function handleApplyDesktopUpdate() {
    const desktopApi = readDesktopApi();
    if (!desktopApi || !desktopUpdaterStatus.updateDownloaded || isApplyingDesktopUpdate) {
      return;
    }

    setIsApplyingDesktopUpdate(true);
    setUiError(null);
    try {
      await desktopApi.quitAndInstallUpdate();
    } catch (error) {
      logHomeError("desktop_update_apply_failed", error, {
        action: "desktop_updater.quitAndInstallUpdate",
        location: "controller.desktopUpdater",
        context: {
          availableVersion: desktopUpdaterStatus.availableVersion,
        },
      });
      setUiError(error instanceof Error ? error.message : "Failed to apply desktop update.");
      setIsApplyingDesktopUpdate(false);
    }
  }

  async function handleCheckDesktopUpdates() {
    const desktopApi = readDesktopApi();
    if (!desktopApi || !desktopUpdaterStatus.supported || desktopUpdaterStatus.checking) {
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
      logHomeError("desktop_update_check_failed", error, {
        action: "desktop_updater.checkForUpdates",
        location: "controller.desktopUpdater",
        context: {
          currentVersion: desktopUpdaterStatus.currentVersion,
        },
      });
      setUiError(error instanceof Error ? error.message : "Failed to check desktop updates.");
    }
  }

  function handleMainSplitterPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
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
        clampNumber(nextRightWidth, HOME_MAIN_SPLITTER_MIN_RIGHT_WIDTH_PX, maxRightWidth),
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
    setAzureLoginError(null);
    setAzureTenantSwitchError(null);

    if (isAzureAuthRequired || isLikelyChatAzureAuthError(azureConnectionError)) {
      setIsAzureAuthRequired(true);
      setActiveMainTab("settings");
      void handleAzureLogin();
      return;
    }

    const needsProjectReload = azureConnections.length === 0 || !activePlaygroundAzureConnection;
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
  const settingsTabProps = {
    appearanceSectionProps: {
      theme,
      onThemeChange: (nextTheme: ThemeMode) => {
        setTheme(nextTheme);
        void saveThemePreference(nextTheme);
      },
    },
    azureConnectionSectionProps: {
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
    },
    utilityModelSectionProps: {
      isAzureAuthRequired,
      isSending,
      isLoadingAzureConnections,
      isLoadingUtilityAzureDeployments,
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
    },
  };

  const mcpServersTabProps = {
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
  };

  const threadsTabProps = {
    instructionSectionProps: {
      agentInstruction,
      instructionContextToggleOptions: THREAD_INSTRUCTION_CONTEXT_OPTIONS.map((option) => ({
        key: option.key,
        label: option.label,
        infoTitle: option.infoTitle,
        infoLines: Array.from(option.infoLines),
        enabled: instructionContextToggles[option.key],
      })),
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
    },
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
  };

  const skillsTabProps = {
    skillsSectionProps: {
      skillOptions: threadSkillOptions,
      isLoadingSkills,
      isSending,
      isThreadReadOnly: isActiveThreadArchived,
      skillsError,
      skillsWarning,
      onReloadSkills: handleReloadSkills,
      onToggleSkill: handleToggleThreadSkill,
      onClearSkillsWarning: () => {
        setSkillsWarning(null);
      },
    },
    skillRegistrySectionProps: {
      skillRegistryGroups,
      isLoadingSkillRegistries: isLoadingSkills,
      isMutatingSkillRegistries,
      skillRegistryError,
      skillRegistryWarning,
      skillRegistrySuccess,
      onReloadSkillRegistries: handleReloadSkills,
      onToggleRegistrySkill: handleToggleRegistrySkill,
      onClearSkillRegistryWarning: () => {
        setSkillRegistryWarning(null);
      },
      onClearSkillRegistrySuccess: () => {
        setSkillRegistrySuccess(null);
      },
    },
  };

  const playgroundPanelProps = {
    messages,
    threadOperationLogsByTurnId,
    isSending,
    isThreadReadOnly: isActiveThreadArchived,
    desktopUpdaterStatus,
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
  };

  const unauthenticatedPanelProps = {
    isStartingAzureLogin,
    onAzureLogin: handleAzureLogin,
  };

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

function resolveSkillBadgeLabel(
  source: "workspace" | "codex_home" | "app_data",
  location: string,
): string {
  if (source === "workspace") {
    return "Workspace";
  }

  if (source === "codex_home") {
    return "CODEX_HOME";
  }

  const registryLabel = readSkillRegistryLabelFromSkillLocation(location);
  return registryLabel ?? "App Data";
}

function readSkillCommandSuggestions(
  skillOptions: Array<{
    name: string;
    description: string;
    location: string;
    badge: string;
    isSelected: boolean;
    isAvailable: boolean;
  }>,
  queryRaw: string,
): ChatCommandSuggestion[] {
  const query = queryRaw.trim().toLowerCase();
  const maxSuggestions = 12;

  return skillOptions
    .filter((skill) => {
      if (!skill.isAvailable) {
        return false;
      }

      if (!query) {
        return true;
      }

      return (
        skill.name.toLowerCase().includes(query) ||
        skill.description.toLowerCase().includes(query) ||
        skill.location.toLowerCase().includes(query)
      );
    })
    .slice(0, maxSuggestions)
    .map((skill) => ({
      id: skill.location,
      label: skill.name,
      description: skill.description,
      detail: `${skill.badge} · ${skill.location}`,
      isSelected: skill.isSelected,
      isAvailable: skill.isAvailable,
    }));
}
