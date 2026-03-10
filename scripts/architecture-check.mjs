/**
 * Repo-wide architecture audit script.
 */
import fs from "node:fs/promises";
import process from "node:process";
import path from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const workspaceRoot = process.cwd();

const checks = [
  {
    key: "serverHttpImports",
    description: "Routes and server modules must not import from ~/lib/server/http.",
    command: "rg",
    args: [
      "-n",
      "from ['\\\"]~/lib/server/http",
      "app/routes",
      "app/lib/server",
      "--glob",
      "!**/*.test.ts",
      "--glob",
      "!**/*.test.tsx",
    ],
  },
  {
    key: "serverHttpFiles",
    description: "Legacy app/lib/server/http files should be retired.",
    rootPath: "app/lib/server/http",
    command: "rg",
    args: ["--files", "app/lib/server/http"],
  },
  {
    key: "clientChatFiles",
    description: "Legacy app/lib/client/chat files should be retired.",
    rootPath: "app/lib/client/chat",
    command: "rg",
    args: ["--files", "app/lib/client/chat"],
  },
  {
    key: "sharedComponentBoundaryViolations",
    description:
      "Shared components must not depend on feature usecases, browser adapters, or server code.",
    command: "rg",
    args: [
      "-n",
      "from ['\\\"]~/lib/(client/usecase|client/infrastructure|server)|from ['\\\"]~/app/routes",
      "app/components/shared",
      "--glob",
      "!**/*.test.ts",
      "--glob",
      "!**/*.test.tsx",
    ],
  },
  {
    key: "domainExternalImports",
    description: "Domain modules must not import from outside ~/lib/domain.",
    command: "rg",
    args: [
      "-n",
      "-P",
      "from ['\\\"]~/(?!lib/domain/)",
      "app/lib/domain",
      "--glob",
      "!**/*.test.ts",
      "--glob",
      "!**/*.test.tsx",
    ],
  },
  {
    key: "domainRepositoryContractImports",
    description: "Domain repository ports must not import transport contracts.",
    command: "rg",
    args: ["-n", "from ['\\\"]~/lib/contracts/", "app/lib/domain/repositories"],
  },
  {
    key: "contractsNonValueObjectDomainImports",
    description:
      "Transport contracts may depend on domain value-objects only, never on entities, repositories, policies, or services.",
    command: "rg",
    args: [
      "-n",
      "from ['\\\"]~/lib/domain/(entities|repositories|policies|services)/",
      "app/lib/contracts",
      "--glob",
      "!**/*.test.ts",
      "--glob",
      "!**/*.test.tsx",
    ],
  },
  {
    key: "legacySkillRegistryContract",
    description: "Legacy skill registry transport contract owner must not exist.",
    rootPath: "app/lib/contracts/skills/registry.ts",
    command: "rg",
    args: ["--files", "app/lib/contracts/skills/registry.ts"],
  },
  {
    key: "threadTitleContractFile",
    description: "Thread title helpers must not live under app/lib/contracts/threads.",
    rootPath: "app/lib/contracts/threads/title.ts",
    command: "rg",
    args: ["--files", "app/lib/contracts/threads/title.ts"],
  },
  {
    key: "contractOperationLogHelpers",
    description:
      "contracts/chat/operation-log.ts must stay transport-only and not own state or presentation helpers.",
    command: "rg",
    args: [
      "-n",
      "upsertThreadOperationLogEntry|buildThreadOperationLogsByTurnId|buildThreadOperationLogCopyPayload|collectSuccessfulSkillGuideLocations",
      "app/lib/contracts/chat/operation-log.ts",
    ],
  },
  {
    key: "contractMcpProfileHelpers",
    description:
      "contracts/mcp/profile.ts must not own client collection or presentation helpers.",
    command: "rg",
    args: [
      "-n",
      "upsertMcpServer|formatMcpServerOption",
      "app/lib/contracts/mcp/profile.ts",
    ],
  },
  {
    key: "legacyMcpConfigKeyContract",
    description: "MCP config key ownership must not live under app/lib/contracts/mcp.",
    rootPath: "app/lib/contracts/mcp/config-key.ts",
    command: "rg",
    args: ["--files", "app/lib/contracts/mcp/config-key.ts"],
  },
  {
    key: "contractMcpProfileKeyHelper",
    description:
      "contracts/mcp/profile.ts must not own MCP config-key helpers.",
    command: "rg",
    args: [
      "-n",
      "buildMcpServerKey",
      "app/lib/contracts/mcp/profile.ts",
    ],
  },
  {
    key: "contractSkillFrontmatterValidation",
    description:
      "contracts/skills/frontmatter.ts must stay parser-only and not own frontmatter validation.",
    command: "rg",
    args: [
      "-n",
      "validateSkillFrontmatter",
      "app/lib/contracts/skills/frontmatter.ts",
    ],
  },
  {
    key: "contractRuntimeEventLogOwnership",
    description:
      "contracts/shared/runtime-event-log.ts must stay transport-only and not own runtime event-log value-object helpers.",
    command: "rg",
    args: [
      "-n",
      "createRuntimeEventLogId|export type RuntimeEventLog(Input|Record|Source|Level)|export function (normalizeRuntimeEventLogLevel|normalizeRuntimeEventLogSource|readErrorDetails|normalizeCreatedAt|normalizeCategory|normalizeEventName|normalizeMessage|normalizeOptionalStatusCode|normalizeOptionalPath|normalizeOptionalLabel|normalizeOptionalTextValue|normalizeOptionalUserId|serializeRuntimeEventContext)",
      "app/lib/contracts/shared/runtime-event-log.ts",
    ],
  },
  {
    key: "legacyThreadOperationLogStateClient",
    description:
      "Client thread operation-log state owner must not reappear outside the domain value-object.",
    rootPath:
      "app/lib/client/usecase/workspace/threads/thread-operation-log-state.ts",
    command: "rg",
    args: [
      "--files",
      "app/lib/client/usecase/workspace/threads/thread-operation-log-state.ts",
    ],
  },
  {
    key: "legacyThreadOperationLogStateServer",
    description:
      "Server thread operation-log state owner must not reappear outside the domain value-object.",
    rootPath: "app/lib/server/usecase/chat/thread-operation-log-state.ts",
    command: "rg",
    args: ["--files", "app/lib/server/usecase/chat/thread-operation-log-state.ts"],
  },
  {
    key: "threadStateHelpersInContracts",
    description:
      "Thread client state, summaries, and state helpers must not live under app/lib/contracts/threads.",
    command: "rg",
    args: [
      "-n",
      "ThreadState|ThreadSummary|buildThreadSummary|convertThreadResourceToState|convertThreadStateToWritePayload|buildThreadSaveSignature|hasThreadInteraction|hasThreadPersistableState|isThreadArchived|isThreadArchivedById|upsertThreadState|readThreadRuntimeStateById|readThreadStateById|updateThreadStateCollectionById",
      "app/lib/contracts/threads",
    ],
  },
  {
    key: "threadAggregateSubtypeExports",
    description:
      "Thread aggregate entity must not own snapshot or nested subtype exports.",
    command: "rg",
    args: [
      "-n",
      "export type (ThreadSnapshot|ThreadProps|ThreadAttachment|ThreadSkillReference|ThreadMessageRole|ThreadOperationType|ThreadSkillProfile|ThreadInstruction|ThreadMessageSkillActivation|ThreadMessage|ThreadMcpHttpServer|ThreadMcpStdioServer|ThreadMcpServer|ThreadOperationLog|ThreadSkillSelection)",
      "app/lib/domain/entities/thread.ts",
    ],
  },
  {
    key: "threadStateMapperDuplicateParsers",
    description:
      "Thread state mapper must reuse shared chat attachment and persisted operation-log parsers.",
    command: "rg",
    args: [
      "-n",
      "function readChatAttachmentList|function readChatAttachmentFromUnknown|function readThreadOperationLogEntryFromUnknown",
      "app/lib/client/usecase/workspace/threads/thread-state-mappers.ts",
    ],
  },
  {
    key: "threadStateSaveHelperOwnership",
    description:
      "thread-state.ts must not own save-shape helpers or depend on thread transport payload contracts.",
    command: "rg",
    args: [
      "-n",
      "from ['\\\"]~/lib/contracts/threads/types|export function (buildThreadSaveSignature|hasThreadInteraction|hasThreadPersistableState|cloneThreadInstructionContexts)",
      "app/lib/client/usecase/workspace/threads/thread-state.ts",
    ],
  },
  {
    key: "threadPersistencePlanOwnership",
    description:
      "Thread persistence orchestration must reuse thread-persistence-plan helpers instead of inline save-eligibility checks.",
    command: "rg",
    args: [
      "-n",
      "export function shouldPersistThreadState",
      "app/lib/client/usecase/workspace/threads/local-thread-state.ts",
    ],
  },
  {
    key: "threadSaveSignatureRegistryOwnership",
    description:
      "Thread save-signature registry helpers must not live in local-thread-state.",
    command: "rg",
    args: [
      "-n",
      "buildThreadSaveSignature|export function setThreadSaveSignatures",
      "app/lib/client/usecase/workspace/threads/local-thread-state.ts",
    ],
  },
  {
    key: "threadPersistenceOperationPlanningDuplication",
    description:
      "Thread persistence operation modules must not inline save signature or persistable-state checks.",
    command: "rg",
    args: [
      "-n",
      "buildThreadSaveSignature|hasThreadPersistableState",
      "app/lib/client/usecase/workspace/threads/thread-persistence-operations.ts",
      "app/lib/client/usecase/workspace/threads/background-effects.ts",
    ],
  },
  {
    key: "threadSaveSignatureRefAccess",
    description:
      "use-workspace, background-effects, and persistence-controller must use thread save-signature accessors instead of touching the ref map directly.",
    command: "rg",
    args: [
      "-n",
      "threadSaveSignatureByIdRef\\.current\\.(get|set)",
      "app/lib/client/usecase/workspace/use-workspace.ts",
      "app/lib/client/usecase/workspace/threads/background-effects.ts",
      "app/lib/client/usecase/workspace/threads/thread-persistence-controller.ts",
    ],
  },
  {
    key: "threadSaveSignatureRefOwnership",
    description:
      "threadSaveSignatureByIdRef must stay private to use-shell instead of leaking into persistence composition.",
    command: "rg",
    args: [
      "-n",
      "threadSaveSignatureByIdRef",
      "app/lib/client/usecase/workspace/use-workspace.ts",
      "app/lib/client/usecase/workspace/threads/thread-persistence-controller.ts",
    ],
  },
  {
    key: "threadSaveEntrySignatureDuplication",
    description:
      "Thread lifecycle and chat-session callers must not assemble save signatures or depend on legacy saved-signature callbacks.",
    command: "rg",
    args: [
      "-n",
      "buildThreadSaveSignature|hasSavedThreadSignature|signature: string",
      "app/lib/client/usecase/workspace/threads/thread-lifecycle-operations.ts",
      "app/lib/client/usecase/workspace/threads/thread-lifecycle-types.ts",
      "app/lib/client/usecase/workspace/chat-session/operations.ts",
      "app/lib/client/usecase/workspace/chat-session/controller.ts",
      "app/lib/client/usecase/workspace/threads/background-effects.ts",
    ],
  },
  {
    key: "threadNameMutationOwnership",
    description:
      "Thread lifecycle and title operations must reuse thread-name-mutation for optimistic rename state updates.",
    command: "rg",
    args: [
      "-n",
      "deps\\.(updateThreadStateById|setActiveThreadNameInput)\\(",
      "app/lib/client/usecase/workspace/threads/thread-lifecycle-operations.ts",
      "app/lib/client/usecase/workspace/threads/thread-title-operations.ts",
    ],
  },
  {
    key: "threadLoadingRuntimeOwnership",
    description:
      "Thread loading controller and composition must use load-status callbacks instead of touching loading refs directly.",
    command: "rg",
    args: [
      "-n",
      "threadLoadRequestSeqRef|isThreadsReadyRef\\.current",
      "app/lib/client/usecase/workspace/use-workspace.ts",
      "app/lib/client/usecase/workspace/threads/thread-loading-controller.ts",
    ],
  },
  {
    key: "threadBackgroundEffectRuntimeOwnership",
    description:
      "use-workspace and background-effects must use runtime status readers instead of boolean thread refs.",
    command: "rg",
    args: [
      "-n",
      "isThreadsReadyRef|isApplyingThreadStateRef|MutableRefObject<boolean>",
      "app/lib/client/usecase/workspace/use-workspace.ts",
      "app/lib/client/usecase/workspace/threads/background-effects.ts",
    ],
  },
  {
    key: "threadBackgroundEffectActiveThreadOwnership",
    description:
      "thread background-effects must use the activeThread value instead of a leaked activeThreadId ref.",
    command: "rg",
    args: [
      "-n",
      "MutableRefObject|activeThreadIdRef",
      "app/lib/client/usecase/workspace/threads/background-effects.ts",
    ],
  },
  {
    key: "threadControllerReaderOwnership",
    description:
      "Thread controller adapters must use reader callbacks instead of raw refs.",
    command: "rg",
    args: [
      "-n",
      "MutableRefObject|activeWorkspaceUserKeyRef|activeThreadIdRef|activeThreadNameInputRef|activeAzureTenantIdRef|threadsRef|threadSaveRequestSeqRef",
      "app/lib/client/usecase/workspace/threads/thread-persistence-controller.ts",
      "app/lib/client/usecase/workspace/threads/thread-loading-controller.ts",
      "app/lib/client/usecase/workspace/threads/thread-title-controller.ts",
    ],
  },
  {
    key: "threadControllerReaderComposition",
    description:
      "use-workspace must not pass thread controller reader state through raw thread name or save request refs.",
    command: "rg",
    args: [
      "-n",
      "activeThreadNameInputRef|threadSaveRequestSeqRef",
      "app/lib/client/usecase/workspace/use-workspace.ts",
    ],
  },
  {
    key: "workspaceThreadAssemblyOwnership",
    description:
      "use-workspace must delegate thread controller, lifecycle, and background-effect assembly to threads/use-workspace-threads.",
    command: "rg",
    args: [
      "-n",
      "createThreadTitleController|createSendMessageController|createThreadLifecycleHandlers|useWorkspaceThreadBackgroundEffects|connectThreadMcpServer",
      "app/lib/client/usecase/workspace/use-workspace.ts",
    ],
  },
  {
    key: "threadPrivateRuntimeRefOwnership",
    description:
      "Thread private state updaters and request-state controller must use reader callbacks instead of raw refs.",
    command: "rg",
    args: [
      "-n",
      "MutableRefObject|threadsRef|threadRequestStateByIdRef|threadSendAbortControllerByIdRef",
      "app/lib/client/usecase/workspace/threads/state-updaters.ts",
      "app/lib/client/usecase/workspace/threads/thread-request-state-controller.ts",
    ],
  },
  {
    key: "threadPrivateRuntimeRefSurface",
    description:
      "use-shell must not leak thread request-state runtime refs through its return surface.",
    command: "rg",
    args: [
      "-n",
      "-P",
      "^\\s+threadRequestStateByIdRef,|^\\s+threadSendAbortControllerByIdRef,",
      "app/lib/client/usecase/workspace/threads/use-shell.ts",
    ],
  },
  {
    key: "legacyChatSessionUsecaseFile",
    description:
      "chat-session generic usecase.ts owner must stay split into send-message intent modules.",
    rootPath: "app/lib/client/usecase/workspace/chat-session/usecase.ts",
    command: "rg",
    args: ["--files", "app/lib/client/usecase/workspace/chat-session/usecase.ts"],
  },
  {
    key: "legacyInstructionEditorHookFile",
    description:
      "instruction-editor public Hook file must use the canonical use-instruction-editor.ts name.",
    rootPath: "app/lib/client/usecase/workspace/instruction-editor/use-editor.ts",
    command: "rg",
    args: [
      "--files",
      "app/lib/client/usecase/workspace/instruction-editor/use-editor.ts",
    ],
  },
  {
    key: "legacyPlaygroundPanelRuntimeHookFile",
    description:
      "playground-panel runtime Hook file must use the canonical use-playground-runtime.ts name.",
    rootPath: "app/lib/client/usecase/workspace/playground-panel/use-runtime.ts",
    command: "rg",
    args: [
      "--files",
      "app/lib/client/usecase/workspace/playground-panel/use-runtime.ts",
    ],
  },
  {
    key: "legacyPlaygroundPanelSessionHookFile",
    description:
      "playground-panel session Hook file must use the canonical use-playground-session.ts name.",
    rootPath: "app/lib/client/usecase/workspace/playground-panel/use-session.ts",
    command: "rg",
    args: [
      "--files",
      "app/lib/client/usecase/workspace/playground-panel/use-session.ts",
    ],
  },
  {
    key: "legacyAzureSettingsEffectsFile",
    description:
      "azure-settings effect Hook file must use the canonical use-azure-settings-effects.ts name.",
    rootPath: "app/lib/client/usecase/workspace/azure-settings/effects.ts",
    command: "rg",
    args: [
      "--files",
      "app/lib/client/usecase/workspace/azure-settings/effects.ts",
    ],
  },
  {
    key: "legacyAzureSettingsRuntimeFile",
    description:
      "azure-settings generic runtime.ts owner must stay retired in favor of catalog-state.ts.",
    rootPath: "app/lib/client/usecase/workspace/azure-settings/runtime.ts",
    command: "rg",
    args: [
      "--files",
      "app/lib/client/usecase/workspace/azure-settings/runtime.ts",
    ],
  },
  {
    key: "legacyMcpProfileFormHookFile",
    description:
      "mcp-profiles public Hook file must use the canonical use-mcp-profile-form.ts name.",
    rootPath: "app/lib/client/usecase/workspace/mcp-profiles/use-form.ts",
    command: "rg",
    args: [
      "--files",
      "app/lib/client/usecase/workspace/mcp-profiles/use-form.ts",
    ],
  },
  {
    key: "legacyMcpProfileControllerFile",
    description:
      "mcp-profiles generic controller.ts owner must stay split into operation-deps and form-editing modules.",
    rootPath: "app/lib/client/usecase/workspace/mcp-profiles/controller.ts",
    command: "rg",
    args: [
      "--files",
      "app/lib/client/usecase/workspace/mcp-profiles/controller.ts",
    ],
  },
  {
    key: "legacyMcpProfileRuntimeFile",
    description:
      "mcp-profiles dead runtime.ts helper owner must stay retired.",
    rootPath: "app/lib/client/usecase/workspace/mcp-profiles/runtime.ts",
    command: "rg",
    args: [
      "--files",
      "app/lib/client/usecase/workspace/mcp-profiles/runtime.ts",
    ],
  },
  {
    key: "azureSettingsBrowserAdapterOwnership",
    description:
      "azure-settings browser effects must stay in client/infrastructure/browser instead of touching document/window directly from the usecase Hook.",
    command: "rg",
    args: [
      "-n",
      "document\\.|window\\.(setInterval|clearInterval|addEventListener|removeEventListener)",
      "app/lib/client/usecase/workspace/azure-settings/use-azure-settings-effects.ts",
    ],
  },
  {
    key: "azureSettingsEffectRefSurfaceOwnership",
    description:
      "azure-settings effect Hook must expose reader/writer callbacks instead of raw workspace refs.",
    command: "rg",
    args: [
      "-n",
      "MutableRefObject|activeAzureTenantIdRef|activeAzurePrincipalIdRef|activeWorkspaceUserKeyRef|selectedPlaygroundAzureConnectionIdRef|selectedPlaygroundAzureDeploymentNameRef|selectedUtilityAzureConnectionIdRef|selectedUtilityAzureDeploymentNameRef",
      "app/lib/client/usecase/workspace/azure-settings/use-azure-settings-effects.ts",
    ],
  },
  {
    key: "azureSettingsPublicOptionRefOwnership",
    description:
      "UseAzureSettingsOptions must expose reader/writer callbacks instead of raw workspace ref properties.",
    command: "rg",
    args: [
      "-n",
      "activeAzureTenantIdRef|activeAzurePrincipalIdRef|activeWorkspaceUserKeyRef|selectedPlaygroundAzureConnectionIdRef|selectedPlaygroundAzureDeploymentNameRef|selectedUtilityAzureConnectionIdRef|selectedUtilityAzureDeploymentNameRef",
      "app/lib/client/usecase/workspace/azure-settings/types.ts",
    ],
  },
  {
    key: "azureSettingsPrivateRuntimeRefOwnership",
    description:
      "azure-settings internal handlers and runtime modules must use accessor callbacks instead of raw ref dependencies.",
    command: "rg",
    args: [
      "-n",
      "MutableRefObject|preferredAzureSelectionRef|azureConnectionsRequestSeqRef|playgroundAzureDeploymentRequestSeqRef|utilityAzureDeploymentRequestSeqRef|workspaceMcpServerProfileLoginRetryTimeoutRef",
      "app/lib/client/usecase/workspace/azure-settings/types.ts",
      "app/lib/client/usecase/workspace/azure-settings/catalog-operations.ts",
      "app/lib/client/usecase/workspace/azure-settings/catalog-runtime.ts",
      "app/lib/client/usecase/workspace/azure-settings/handlers.ts",
    ],
  },
  {
    key: "legacyConfigPanelPropsFile",
    description:
      "config-panel generic panel-props.ts wrapper must stay retired.",
    rootPath: "app/lib/client/usecase/workspace/config-panel/panel-props.ts",
    command: "rg",
    args: [
      "--files",
      "app/lib/client/usecase/workspace/config-panel/panel-props.ts",
    ],
  },
  {
    key: "legacyPlaygroundPanelPropsFile",
    description:
      "playground-panel generic panel-props.ts wrapper must use the concept-specific workspace owner name.",
    rootPath: "app/lib/client/usecase/workspace/playground-panel/panel-props.ts",
    command: "rg",
    args: [
      "--files",
      "app/lib/client/usecase/workspace/playground-panel/panel-props.ts",
    ],
  },
  {
    key: "legacySkillCatalogEffectsFile",
    description:
      "skills-catalog effect Hook file must use the canonical use-skill-catalog-effects.ts name.",
    rootPath: "app/lib/client/usecase/workspace/skills-catalog/effects.ts",
    command: "rg",
    args: [
      "--files",
      "app/lib/client/usecase/workspace/skills-catalog/effects.ts",
    ],
  },
  {
    key: "legacyWorkspaceFilesUtility",
    description:
      "workspace generic files.ts utility bucket must stay retired in favor of narrow feature-local file helpers.",
    rootPath: "app/lib/client/usecase/workspace/files.ts",
    command: "rg",
    args: ["--files", "app/lib/client/usecase/workspace/files.ts"],
  },
  {
    key: "legacyWorkspaceNumbersUtility",
    description:
      "workspace generic numbers.ts utility bucket must stay retired in favor of narrow feature-local numeric helpers.",
    rootPath: "app/lib/client/usecase/workspace/numbers.ts",
    command: "rg",
    args: ["--files", "app/lib/client/usecase/workspace/numbers.ts"],
  },
  {
    key: "legacyWorkspaceIdsUtility",
    description:
      "workspace generic ids.ts utility bucket must stay retired in favor of the explicit runtime-id owner.",
    rootPath: "app/lib/client/usecase/workspace/ids.ts",
    command: "rg",
    args: ["--files", "app/lib/client/usecase/workspace/ids.ts"],
  },
  {
    key: "legacyWorkspaceTypesFile",
    description:
      "workspace generic types.ts bucket must stay retired in favor of feature-local type owners.",
    rootPath: "app/lib/client/usecase/workspace/types.ts",
    command: "rg",
    args: ["--files", "app/lib/client/usecase/workspace/types.ts"],
  },
  {
    key: "legacyWorkspaceStateFile",
    description:
      "workspace generic state.ts bucket must stay retired in favor of feature-local state owners.",
    rootPath: "app/lib/client/usecase/workspace/state.ts",
    command: "rg",
    args: ["--files", "app/lib/client/usecase/workspace/state.ts"],
  },
  {
    key: "legacyWorkspaceReducerFile",
    description:
      "workspace generic reducer.ts bucket must stay retired in favor of feature-local reducer owners.",
    rootPath: "app/lib/client/usecase/workspace/reducer.ts",
    command: "rg",
    args: ["--files", "app/lib/client/usecase/workspace/reducer.ts"],
  },
  {
    key: "legacyThreadRequestStateControllerFile",
    description:
      "threads generic request-state.ts file must use the explicit thread-request-state-controller.ts owner name.",
    rootPath: "app/lib/client/usecase/workspace/threads/request-state.ts",
    command: "rg",
    args: ["--files", "app/lib/client/usecase/workspace/threads/request-state.ts"],
  },
  {
    key: "legacyDesktopUpdaterRuntimeFile",
    description:
      "desktop-updater browser adapter must not live under client/usecase/workspace/desktop-updater/runtime.ts.",
    rootPath: "app/lib/client/usecase/workspace/desktop-updater/runtime.ts",
    command: "rg",
    args: [
      "--files",
      "app/lib/client/usecase/workspace/desktop-updater/runtime.ts",
    ],
  },
  {
    key: "desktopUpdaterBrowserAdapterOwnership",
    description:
      "desktop-updater browser adapter helpers must stay in client/infrastructure/browser.",
    command: "rg",
    args: [
      "-n",
      "function (readDesktopApi|readDesktopUpdaterStatusFromUnknown)|type DesktopUpdaterApi =",
      "app/lib/client/usecase/workspace/desktop-updater",
    ],
  },
  {
    key: "workspaceLayoutBrowserAdapterOwnership",
    description:
      "workspace layout browser listeners and document body styling must stay in client/infrastructure/browser instead of the usecase Hook.",
    command: "rg",
    args: [
      "-n",
      "document\\.|window\\.(addEventListener|removeEventListener)",
      "app/lib/client/usecase/workspace/layout/use-layout.ts",
    ],
  },
  {
    key: "workspaceLegacyUtilityImports",
    description:
      "workspace features must not import retired generic files.ts, numbers.ts, or ids.ts buckets.",
    command: "rg",
    args: [
      "-n",
      "from ['\\\"]~/lib/client/usecase/workspace/(files|numbers|ids)['\\\"]",
      "app/lib/client/usecase/workspace",
      "--glob",
      "!**/*.test.ts",
      "--glob",
      "!**/*.test.tsx",
    ],
  },
  {
    key: "workspaceLegacyTypesImports",
    description:
      "workspace features must not import the retired generic workspace/types.ts bucket.",
    command: "rg",
    args: [
      "-n",
      "from ['\\\"]~/lib/client/usecase/workspace/types['\\\"]",
      "app",
      "--glob",
      "!**/*.test.ts",
      "--glob",
      "!**/*.test.tsx",
    ],
  },
  {
    key: "workspaceLegacyStateReducerImports",
    description:
      "workspace features must not import the retired generic workspace/state.ts or workspace/reducer.ts buckets.",
    command: "rg",
    args: [
      "-n",
      "from ['\\\"]~/lib/client/usecase/workspace/(state|reducer)['\\\"]",
      "app",
      "--glob",
      "!**/*.test.ts",
      "--glob",
      "!**/*.test.tsx",
    ],
  },
  {
    key: "skillCatalogControllerRefOwnership",
    description:
      "skills-catalog controller must stay callback-first and must not own raw ref access.",
    command: "rg",
    args: [
      "-n",
      "MutableRefObject|activeWorkspaceUserKeyRef|skillsRequestSeqRef|lastManualSkillsReloadAtRef",
      "app/lib/client/usecase/workspace/skills-catalog/controller.ts",
    ],
  },
  {
    key: "skillCatalogHookRefSurfaceOwnership",
    description:
      "use-skill-catalog must expose reader callbacks instead of taking workspace user refs through its public surface.",
    command: "rg",
    args: [
      "-n",
      "MutableRefObject|activeWorkspaceUserKeyRef",
      "app/lib/client/usecase/workspace/skills-catalog/use-skill-catalog.ts",
    ],
  },
  {
    key: "chatSessionControllerRefOwnership",
    description:
      "chat-session controller must stay callback-first and must not own raw thread or azure refs.",
    command: "rg",
    args: [
      "-n",
      "MutableRefObject|activeThreadIdRef|activeAzureTenantIdRef|threadsRef",
      "app/lib/client/usecase/workspace/chat-session/controller.ts",
    ],
  },
  {
    key: "legacyWorkspaceViewTypesFile",
    description:
      "workspace generic view-types.ts bucket must stay retired in favor of feature-local view type owners.",
    rootPath: "app/lib/client/usecase/workspace/view-types.ts",
    command: "rg",
    args: ["--files", "app/lib/client/usecase/workspace/view-types.ts"],
  },
  {
    key: "workspaceLegacyViewTypeImports",
    description:
      "workspace features must not import the retired generic workspace/view-types.ts bucket.",
    command: "rg",
    args: [
      "-n",
      "from ['\\\"]~/lib/client/usecase/workspace/view-types['\\\"]",
      "app",
      "--glob",
      "!**/*.test.ts",
      "--glob",
      "!**/*.test.tsx",
    ],
  },
  {
    key: "workspaceRuntimeLoggingOwnership",
    description:
      "use-workspace must reuse the runtime-logging Hook instead of installing global client logging inline.",
    command: "rg",
    args: [
      "-n",
      "installGlobalClientErrorLogging|createWorkspaceRuntimeLogging",
      "app/lib/client/usecase/workspace/use-workspace.ts",
    ],
  },
  {
    key: "workspaceThreadSaveSchedulingOwnership",
    description:
      "use-workspace must reuse thread storage runtime scheduling instead of inlining deferred thread saves.",
    command: "rg",
    args: [
      "-n",
      "window\\.setTimeout\\(|saveThreadStateSilentlyIfNeeded\\(",
      "app/lib/client/usecase/workspace/use-workspace.ts",
    ],
  },
  {
    key: "workspaceThreadBrowserTimerOwnership",
    description:
      "thread background-effects and shell must reuse browser timer adapters instead of using window timeouts inline.",
    command: "rg",
    args: [
      "-n",
      "window\\.(setTimeout|clearTimeout)",
      "app/lib/client/usecase/workspace/threads/background-effects.ts",
      "app/lib/client/usecase/workspace/threads/use-shell.ts",
    ],
  },
  {
    key: "workspaceThreadTimeoutRefLeakage",
    description:
      "thread timeout refs must stay inside use-shell instead of leaking into use-workspace or background-effects.",
    command: "rg",
    args: [
      "-n",
      "thread(Name|Save|Title)TimeoutRef",
      "app/lib/client/usecase/workspace/use-workspace.ts",
      "app/lib/client/usecase/workspace/threads/background-effects.ts",
    ],
  },
  {
    key: "azureSettingsBrowserTimerOwnership",
    description:
      "azure-settings timer scheduling must stay in client/infrastructure/browser instead of usecase operations.",
    command: "rg",
    args: [
      "-n",
      "window\\.(setTimeout|clearTimeout)",
      "app/lib/client/usecase/workspace/azure-settings/catalog-runtime.ts",
      "app/lib/client/usecase/workspace/azure-settings/session-operations.ts",
    ],
  },
  {
    key: "legacyThreadMcpServerOperations",
    description:
      "Thread MCP server membership policy must not be reintroduced under client/usecase/workspace/threads.",
    rootPath:
      "app/lib/client/usecase/workspace/threads/thread-mcp-server-operations.ts",
    command: "rg",
    args: [
      "--files",
      "app/lib/client/usecase/workspace/threads/thread-mcp-server-operations.ts",
    ],
  },
  {
    key: "legacyAzureOpenAIUrlOwner",
    description:
      "Azure OpenAI baseUrl normalization must not live under server/usecase/azure.",
    rootPath: "app/lib/server/usecase/azure/azure-openai-url.ts",
    command: "rg",
    args: ["--files", "app/lib/server/usecase/azure/azure-openai-url.ts"],
  },
  {
    key: "azureCapabilityHelperDuplication",
    description:
      "Azure deployment capability helpers must stay in the domain value-object instead of server/usecase/azure.",
    command: "rg",
    args: [
      "-n",
      "function (buildModelCapabilitiesMap|isAgentsSdkCompatibleDeployment|resolveDeploymentReasoningEffortOptions|resolveReasoningEffortOptionsByModelName|parseReasoningEffortOptionsFromString|mergeReasoningEffortOptions|isDeploymentSucceeded|createModelKey)|const (buildModelCapabilitiesMap|isAgentsSdkCompatibleDeployment|resolveDeploymentReasoningEffortOptions|resolveReasoningEffortOptionsByModelName|parseReasoningEffortOptionsFromString|mergeReasoningEffortOptions|isDeploymentSucceeded|createModelKey)\\s*=",
      "app/lib/server/usecase/azure",
      "--glob",
      "!**/*.test.ts",
    ],
  },
  {
    key: "skillFrontmatterInfraScalarValidationOwnership",
    description:
      "Skill frontmatter infra validation must reuse the domain scalar invariant owner instead of inline name/description rules.",
    command: "rg",
    args: [
      "-n",
      "AGENT_SKILL_NAME_PATTERN|AGENT_SKILL_NAME_MAX_LENGTH|AGENT_SKILL_DESCRIPTION_MAX_LENGTH",
      "app/lib/server/infrastructure/gateways/skills/skill-frontmatter-validation.ts",
    ],
  },
  {
    key: "mcpServerProfileServicePolicyDuplication",
    description:
      "MCP server profile service must not redefine extracted pure default/legacy/upsert policy helpers.",
    command: "rg",
    args: [
      "-n",
      "function (buildDefaultMcpServerProfiles|normalizeLegacyDefaultProfiles|isLegacyDefaultMermaidProfile|isLegacyDefaultFilesystemProfile|isLegacyUnavailableDefaultStdioProfile|isLegacyDefaultWorkingDirectory|buildIncomingProfileKey)",
      "app/lib/server/usecase/mcp/mcp-server-profile-service.ts",
    ],
  },
  {
    key: "raw405InRoutes",
    description: "Route modules should use methodNotAllowedResponse helpers instead of raw 405 values.",
    command: "rg",
    args: [
      "-n",
      "\\b405\\b",
      "app/routes",
      "--glob",
      "!**/*.test.ts",
      "--glob",
      "!**/*.test.tsx",
    ],
  },
  {
    key: "historicalNaming",
    description: "Historical thread/entity naming should not remain in app sources.",
    command: "rg",
    args: [
      "-n",
      "ThreadRecord|ThreadRecordSnapshot|AzureSelectionPreferenceSnapshot|savePayload\\(|toSnapshot\\(|fromSnapshot\\(",
      "app",
      "--glob",
      "!**/*.test.ts",
      "--glob",
      "!**/*.test.tsx",
    ],
  },
];

async function main() {
  const report = {};
  let hasAnyFindings = false;

  for (const check of checks) {
    const actual = await runCheck(check);
    const hasFindings = actual.length > 0;
    hasAnyFindings ||= hasFindings;

    report[check.key] = {
      description: check.description,
      actual,
    };
  }

  printReport(report);

  if (hasAnyFindings) {
    process.exitCode = 1;
  }
}

async function runCheck(check) {
  if (check.rootPath && !(await pathExists(path.join(workspaceRoot, check.rootPath)))) {
    return [];
  }

  try {
    const { stdout } = await execFile(check.command, check.args, {
      cwd: workspaceRoot,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
    return normalizeFindings(stdout.split("\n"));
  } catch (error) {
    if (typeof error?.code === "number" && error.code === 1) {
      return normalizeFindings(error.stdout?.split("\n") ?? []);
    }
    throw error;
  }
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function normalizeFindings(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map((item) => `${item}`.trim()).filter(Boolean))].sort();
}

function printReport(report) {
  const keys = Object.keys(report);
  for (const key of keys) {
    const section = report[key];
    const count = section.actual.length;
    console.log(`\n[${key}] ${section.description}`);
    console.log(`findings: ${count}`);
    for (const finding of section.actual) {
      console.log(`  - ${finding}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
