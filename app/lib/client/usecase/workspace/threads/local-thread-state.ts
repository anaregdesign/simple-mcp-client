import {
  DEFAULT_AGENT_INSTRUCTION,
  DEFAULT_REASONING_EFFORT,
  DEFAULT_WEB_SEARCH_ENABLED,
  THREAD_DEFAULT_NAME,
} from "~/lib/domain/value-objects/thread-defaults";
import { THREAD_NAME_MAX_LENGTH } from "~/lib/constants/client";
import type { McpServerConfig } from "~/lib/contracts/mcp/profile";
import {
  buildThreadSaveSignature,
  cloneMcpServers,
  cloneMessages,
  cloneThreadEnvironment,
  cloneThreadInstructionContexts,
  cloneThreadOperationLogs,
  cloneThreadSkillActivations,
  hasThreadPersistableState,
} from "~/lib/contracts/threads/state";
import { DEFAULT_THREAD_INSTRUCTION_CONTEXT_TOGGLES } from "~/lib/domain/value-objects/thread-instruction-context";
import type { ThreadState } from "~/lib/contracts/threads/types";
import type { ThreadMessage } from "~/lib/contracts/chat/messages";
import type { ThreadOperationLogEntry } from "~/lib/contracts/chat/operation-log";
import type { ThreadSkillActivation } from "~/lib/contracts/skills/types";

type CreateLocalThreadStateOptions = {
  name?: string;
  defaultThreadMcpServers: McpServerConfig[];
  createThreadId: () => string;
  now?: () => string;
};

type BuildThreadStateFromCurrentStateOptions = {
  includeDraftName?: boolean;
  activeThreadNameInput: string;
  reasoningEffort: ThreadState["reasoningEffort"];
  webSearchEnabled: ThreadState["webSearchEnabled"];
  chatAzureConfig?: ThreadState["chatAzureConfig"];
  agentInstruction: ThreadState["agentInstruction"];
  instructionContextToggles: ThreadState["instructionContextToggles"];
  messages: ThreadMessage[];
  mcpServers: McpServerConfig[];
  mcpRpcLogs: ThreadOperationLogEntry[];
  selectedThreadSkills: ThreadSkillActivation[];
  now?: () => string;
};

export function resolveThreadNameForSave(
  baseName: string,
  includeDraftName: boolean,
  activeThreadNameInput: string,
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

export function shouldPersistThreadState(
  thread: Pick<
    ThreadState,
    | "id"
    | "messages"
    | "reasoningEffort"
    | "webSearchEnabled"
    | "chatAzureConfig"
    | "agentInstruction"
    | "instructionContextToggles"
    | "threadEnvironment"
  > &
    Partial<Pick<ThreadState, "skillSelections">>,
  signatureMap: Map<string, string>,
): boolean {
  if (hasThreadPersistableState(thread)) {
    return true;
  }

  return signatureMap.has(thread.id);
}

export function createLocalThreadState(
  options: CreateLocalThreadStateOptions,
): ThreadState {
  const now = (options.now ?? (() => new Date().toISOString()))();
  const normalizedName = (options.name ?? "")
    .trim()
    .slice(0, THREAD_NAME_MAX_LENGTH);
  const name = normalizedName || THREAD_DEFAULT_NAME;

  return {
    id: options.createThreadId(),
    name,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    reasoningEffort: DEFAULT_REASONING_EFFORT,
    webSearchEnabled: DEFAULT_WEB_SEARCH_ENABLED,
    chatAzureConfig: null,
    agentInstruction: DEFAULT_AGENT_INSTRUCTION,
    instructionContextToggles: cloneThreadInstructionContexts(
      DEFAULT_THREAD_INSTRUCTION_CONTEXT_TOGGLES,
    ),
    threadEnvironment: {},
    messages: [],
    mcpServers: cloneMcpServers(options.defaultThreadMcpServers),
    mcpRpcLogs: [],
    skillSelections: [],
  };
}

export function buildThreadStateFromCurrentState(
  base: ThreadState,
  options: BuildThreadStateFromCurrentStateOptions,
): ThreadState {
  const includeDraftName = options.includeDraftName === true;
  return {
    ...base,
    name: resolveThreadNameForSave(
      base.name,
      includeDraftName,
      options.activeThreadNameInput,
    ),
    updatedAt: (options.now ?? (() => new Date().toISOString()))(),
    reasoningEffort: options.reasoningEffort,
    webSearchEnabled: options.webSearchEnabled,
    chatAzureConfig: options.chatAzureConfig
      ? { ...options.chatAzureConfig }
      : base.chatAzureConfig
        ? { ...base.chatAzureConfig }
        : null,
    agentInstruction: options.agentInstruction,
    instructionContextToggles: cloneThreadInstructionContexts(
      options.instructionContextToggles,
    ),
    threadEnvironment: cloneThreadEnvironment(base.threadEnvironment),
    messages: cloneMessages(options.messages),
    mcpServers: cloneMcpServers(options.mcpServers),
    mcpRpcLogs: cloneThreadOperationLogs(options.mcpRpcLogs),
    skillSelections: cloneThreadSkillActivations(options.selectedThreadSkills),
  };
}

export function setThreadSaveSignatures(
  signatureMap: Map<string, string>,
  threads: ThreadState[],
): void {
  signatureMap.clear();
  for (const thread of threads) {
    signatureMap.set(thread.id, buildThreadSaveSignature(thread));
  }
}
