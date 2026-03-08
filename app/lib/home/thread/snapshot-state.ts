/**
 * Client runtime support module.
 */
import {
  HOME_DEFAULT_REASONING_EFFORT,
  HOME_DEFAULT_WEB_SEARCH_ENABLED,
} from "~/lib/constants";
import type { McpServerConfig } from "~/lib/home/mcp/profile";
import type { ThreadMessage } from "~/lib/home/chat/messages";
import type { ThreadOperationLogEntry } from "~/lib/home/chat/stream";
import type { ThreadSkillActivation } from "~/lib/home/skills/types";
import type { ThreadEnvironment } from "~/lib/home/thread/environment";
import {
  cloneThreadInstructionContextToggles,
  hasNonDefaultThreadInstructionContextToggles,
} from "~/lib/home/thread/instruction-context";
import type { ThreadSnapshot } from "~/lib/home/thread/types";

export function cloneMessages(value: ThreadMessage[]): ThreadMessage[] {
  return value.map((message) => ({
    ...message,
    attachments: message.attachments.map((attachment) => ({ ...attachment })),
    skillActivations: message.skillActivations.map((selection) => ({ ...selection })),
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

export function cloneThreadOperationLogs(value: ThreadOperationLogEntry[]): ThreadOperationLogEntry[] {
  return value.map((entry) => ({
    ...entry,
  }));
}

export function cloneThreadSkillActivations(value: ThreadSkillActivation[]): ThreadSkillActivation[] {
  return value.map((entry) => ({
    ...entry,
  }));
}

export function cloneThreadEnvironment(value: ThreadEnvironment): ThreadEnvironment {
  return { ...value };
}

export function cloneThreadInstructionContexts(
  value: ThreadSnapshot["instructionContextToggles"],
): ThreadSnapshot["instructionContextToggles"] {
  return cloneThreadInstructionContextToggles(value);
}

export function buildThreadSaveSignature(snapshot: ThreadSnapshot): string {
  return JSON.stringify({
    name: snapshot.name,
    deletedAt: snapshot.deletedAt,
    reasoningEffort: snapshot.reasoningEffort,
    webSearchEnabled: snapshot.webSearchEnabled,
    agentInstruction: snapshot.agentInstruction,
    instructionContextToggles: snapshot.instructionContextToggles,
    threadEnvironment: snapshot.threadEnvironment,
    messages: snapshot.messages,
    mcpServers: snapshot.mcpServers,
    mcpRpcLogs: snapshot.mcpRpcLogs,
    skillSelections: snapshot.skillSelections,
  });
}

export function hasThreadInteraction(
  snapshot: Pick<ThreadSnapshot, "messages"> &
    Partial<Pick<ThreadSnapshot, "skillSelections">>,
): boolean {
  if (snapshot.messages.length > 0) {
    return true;
  }

  return (snapshot.skillSelections?.length ?? 0) > 0;
}

export function hasThreadPersistableState(
  snapshot: Pick<
    ThreadSnapshot,
    | "messages"
    | "reasoningEffort"
    | "webSearchEnabled"
    | "instructionContextToggles"
    | "threadEnvironment"
  > &
    Partial<Pick<ThreadSnapshot, "skillSelections">>,
): boolean {
  if (hasThreadInteraction(snapshot)) {
    return true;
  }

  return (
    snapshot.reasoningEffort !== HOME_DEFAULT_REASONING_EFFORT ||
    snapshot.webSearchEnabled !== HOME_DEFAULT_WEB_SEARCH_ENABLED ||
    hasNonDefaultThreadInstructionContextToggles(snapshot.instructionContextToggles) ||
    Object.keys(snapshot.threadEnvironment).length > 0
  );
}

export function isThreadSnapshotArchived(
  snapshot: Pick<ThreadSnapshot, "deletedAt"> | null | undefined,
): boolean {
  return snapshot !== null && snapshot !== undefined && snapshot.deletedAt !== null;
}

export function isThreadArchivedById(
  snapshots: Array<Pick<ThreadSnapshot, "id" | "deletedAt">>,
  threadIdRaw: string,
): boolean {
  const threadId = threadIdRaw.trim();
  if (!threadId) {
    return false;
  }

  const snapshot = snapshots.find((entry) => entry.id === threadId);
  return isThreadSnapshotArchived(snapshot);
}

export function upsertThreadSnapshot(
  current: ThreadSnapshot[],
  next: ThreadSnapshot,
): ThreadSnapshot[] {
  const existingIndex = current.findIndex((thread) => thread.id === next.id);
  if (existingIndex < 0) {
    return [next, ...current].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  const updated = current.map((thread, index) => (index === existingIndex ? next : thread));
  return updated.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function readThreadSnapshotById(
  snapshots: ThreadSnapshot[],
  threadIdRaw: string,
): ThreadSnapshot | null {
  const threadId = threadIdRaw.trim();
  if (!threadId) {
    return null;
  }

  return snapshots.find((thread) => thread.id === threadId) ?? null;
}

export function readThreadRuntimeStateById(
  snapshots: ThreadSnapshot[],
  threadIdRaw: string,
): {
  activeThreadSnapshot: ThreadSnapshot | null;
  messages: ThreadMessage[];
  mcpServers: McpServerConfig[];
  mcpRpcLogs: ThreadOperationLogEntry[];
  skillSelections: ThreadSkillActivation[];
} {
  const activeThreadSnapshot = readThreadSnapshotById(snapshots, threadIdRaw);
  if (!activeThreadSnapshot) {
    return {
      activeThreadSnapshot: null,
      messages: [],
      mcpServers: [],
      mcpRpcLogs: [],
      skillSelections: [],
    };
  }

  return {
    activeThreadSnapshot,
    messages: cloneMessages(activeThreadSnapshot.messages),
    mcpServers: cloneMcpServers(activeThreadSnapshot.mcpServers),
    mcpRpcLogs: cloneThreadOperationLogs(activeThreadSnapshot.mcpRpcLogs),
    skillSelections: cloneThreadSkillActivations(activeThreadSnapshot.skillSelections),
  };
}

export function updateThreadSnapshotCollectionById(
  snapshots: ThreadSnapshot[],
  threadIdRaw: string,
  updater: (current: ThreadSnapshot) => ThreadSnapshot,
): ThreadSnapshot[] {
  const threadId = threadIdRaw.trim();
  if (!threadId) {
    return snapshots;
  }

  const currentThread = readThreadSnapshotById(snapshots, threadId);
  if (!currentThread) {
    return snapshots;
  }

  const nextThread = updater(currentThread);
  return upsertThreadSnapshot(snapshots, {
    ...nextThread,
    updatedAt: nextThread.updatedAt || new Date().toISOString(),
  });
}
