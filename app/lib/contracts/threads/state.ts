import {
  DEFAULT_REASONING_EFFORT,
  DEFAULT_WEB_SEARCH_ENABLED,
} from "~/lib/constants/chat";
import type { ThreadMessage } from "~/lib/contracts/chat/messages";
import type { ThreadOperationLogEntry } from "~/lib/contracts/chat/operation-log";
import type { McpServerConfig } from "~/lib/contracts/mcp/profile";
import type { ThreadSkillActivation } from "~/lib/contracts/skills/types";
import {
  cloneThreadEnvironment,
  type ThreadEnvironment,
} from "~/lib/contracts/threads/environment";
import {
  cloneThreadInstructionContextToggles,
  hasNonDefaultThreadInstructionContextToggles,
} from "~/lib/contracts/threads/instruction-context";
import type { ThreadState, ThreadWritePayload } from "~/lib/contracts/threads/types";

export function cloneMessages(value: ThreadMessage[]): ThreadMessage[] {
  return value.map((message) => ({
    ...message,
    attachments: message.attachments.map((attachment) => ({ ...attachment })),
    skillActivations: message.skillActivations.map((selection) => ({
      ...selection,
    })),
  }));
}

export function cloneMcpServers(value: McpServerConfig[]): McpServerConfig[] {
  return value.map((server) =>
    server.transport === "stdio"
      ? {
          ...server,
          args: [...server.args],
          env: { ...server.env },
        }
      : {
          ...server,
          headers: { ...server.headers },
        },
  );
}

export function cloneThreadOperationLogs(
  value: ThreadOperationLogEntry[],
): ThreadOperationLogEntry[] {
  return value.map((entry) => ({
    ...entry,
  }));
}

export function cloneThreadSkillActivations(
  value: ThreadSkillActivation[],
): ThreadSkillActivation[] {
  return value.map((entry) => ({
    ...entry,
  }));
}

export { cloneThreadEnvironment };

export function cloneThreadInstructionContexts(
  value: ThreadWritePayload["instructionContextToggles"],
): ThreadWritePayload["instructionContextToggles"] {
  return cloneThreadInstructionContextToggles(value);
}

export function buildThreadSaveSignature(
  snapshot: ThreadWritePayload | ThreadState,
): string {
  return JSON.stringify({
    name: snapshot.name,
    reasoningEffort: snapshot.reasoningEffort,
    webSearchEnabled: snapshot.webSearchEnabled,
    instruction:
      "instruction" in snapshot
        ? snapshot.instruction
        : { content: snapshot.agentInstruction },
    instructionContextToggles: snapshot.instructionContextToggles,
    threadEnvironment: snapshot.threadEnvironment,
    messages: snapshot.messages,
    mcpServers: snapshot.mcpServers,
    mcpRpcLogs: snapshot.mcpRpcLogs,
    skillSelections: snapshot.skillSelections,
  });
}

export function hasThreadInteraction(
  snapshot: Pick<ThreadWritePayload, "messages"> &
    Partial<Pick<ThreadWritePayload, "skillSelections">>,
): boolean {
  if (snapshot.messages.length > 0) {
    return true;
  }

  return (snapshot.skillSelections?.length ?? 0) > 0;
}

export function hasThreadPersistableState(
  snapshot: Pick<
    ThreadWritePayload,
    | "messages"
    | "reasoningEffort"
    | "webSearchEnabled"
    | "instructionContextToggles"
    | "threadEnvironment"
  > &
    Partial<Pick<ThreadWritePayload, "skillSelections">>,
): boolean {
  if (hasThreadInteraction(snapshot)) {
    return true;
  }

  return (
    snapshot.reasoningEffort !== DEFAULT_REASONING_EFFORT ||
    snapshot.webSearchEnabled !== DEFAULT_WEB_SEARCH_ENABLED ||
    hasNonDefaultThreadInstructionContextToggles(
      snapshot.instructionContextToggles,
    ) ||
    Object.keys(snapshot.threadEnvironment).length > 0
  );
}

export function isThreadArchived(
  thread: Pick<ThreadState, "deletedAt"> | null | undefined,
): boolean {
  return thread !== null && thread !== undefined && thread.deletedAt !== null;
}

export function isThreadArchivedById(
  snapshots: Array<Pick<ThreadState, "id" | "deletedAt">>,
  threadIdRaw: string,
): boolean {
  const threadId = threadIdRaw.trim();
  if (!threadId) {
    return false;
  }

  const thread = snapshots.find((entry) => entry.id === threadId);
  return isThreadArchived(thread);
}

export function upsertThreadState(
  current: ThreadState[],
  next: ThreadState,
): ThreadState[] {
  const existingIndex = current.findIndex((thread) => thread.id === next.id);
  if (existingIndex < 0) {
    return [next, ...current].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    );
  }

  const updated = current.map((thread, index) =>
    index === existingIndex ? next : thread,
  );
  return updated.sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
}

export function readThreadStateById(
  threads: ThreadState[],
  threadIdRaw: string,
): ThreadState | null {
  const threadId = threadIdRaw.trim();
  if (!threadId) {
    return null;
  }

  return threads.find((thread) => thread.id === threadId) ?? null;
}

export function readThreadRuntimeStateById(
  threads: ThreadState[],
  threadIdRaw: string,
): {
  activeThreadState: ThreadState | null;
  messages: ThreadMessage[];
  mcpServers: McpServerConfig[];
  mcpRpcLogs: ThreadOperationLogEntry[];
  skillSelections: ThreadSkillActivation[];
} {
  const activeThreadState = readThreadStateById(threads, threadIdRaw);
  if (!activeThreadState) {
    return {
      activeThreadState: null,
      messages: [],
      mcpServers: [],
      mcpRpcLogs: [],
      skillSelections: [],
    };
  }

  return {
    activeThreadState,
    messages: cloneMessages(activeThreadState.messages),
    mcpServers: cloneMcpServers(activeThreadState.mcpServers),
    mcpRpcLogs: cloneThreadOperationLogs(activeThreadState.mcpRpcLogs),
    skillSelections: cloneThreadSkillActivations(
      activeThreadState.skillSelections,
    ),
  };
}

export function updateThreadStateCollectionById(
  threads: ThreadState[],
  threadIdRaw: string,
  updater: (current: ThreadState) => ThreadState,
): ThreadState[] {
  const threadId = threadIdRaw.trim();
  if (!threadId) {
    return threads;
  }

  const currentThread = readThreadStateById(threads, threadId);
  if (!currentThread) {
    return threads;
  }

  const nextThread = updater(currentThread);
  return upsertThreadState(threads, {
    ...nextThread,
    updatedAt: nextThread.updatedAt || new Date().toISOString(),
  });
}
