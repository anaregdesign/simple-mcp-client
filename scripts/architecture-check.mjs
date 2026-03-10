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
