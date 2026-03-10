import type { ThreadMessage } from "~/lib/contracts/chat/messages";
import type { ThreadOperationLogEntry } from "~/lib/contracts/chat/operation-log";
import type { McpServerConfig } from "~/lib/contracts/mcp/profile";
import type { ThreadSkillActivation } from "~/lib/contracts/skills/types";
import {
  cloneMcpServers,
  cloneMessages,
  cloneThreadOperationLogs,
  cloneThreadSkillActivations,
  type ThreadSaveState,
} from "~/lib/client/usecase/workspace/threads/thread-save-state";

export type ThreadState = ThreadSaveState & {
  updatedAt: string;
  deletedAt: string | null;
  agentConversationId?: string | null;
};

export type ThreadSummary = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  messageCount: number;
  mcpServerCount: number;
};

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
