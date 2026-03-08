/**
 * Client controller thread runtime helpers.
 */
import { DEFAULT_THREAD_REQUEST_STATE } from "~/lib/constants/client";
import type { ThreadSkillActivation } from "~/lib/contracts/skills/types";
import type {
  ThreadSnapshot,
  ThreadSummary,
} from "~/lib/contracts/threads/types";
import type { ThreadRequestState } from "~/lib/client/controller/types";

export type ThreadListOption = {
  id: string;
  name: string;
  updatedAt: string;
  deletedAt: string | null;
  messageCount: number;
  mcpServerCount: number;
  isAwaitingResponse: boolean;
};

export function buildThreadListOptions(options: {
  summaries: ThreadSummary[];
  threadRequestStateById: Record<string, ThreadRequestState>;
  renameActiveThreadId?: string;
  activeThreadNameInput?: string;
}): ThreadListOption[] {
  const renameActiveThreadId = options.renameActiveThreadId?.trim() ?? "";
  const activeThreadNameInput = options.activeThreadNameInput ?? "";

  return options.summaries.map((thread) => ({
    id: thread.id,
    name:
      renameActiveThreadId &&
      thread.id === renameActiveThreadId &&
      activeThreadNameInput.trim().length > 0
        ? activeThreadNameInput
        : thread.name,
    updatedAt: thread.updatedAt,
    deletedAt: thread.deletedAt,
    messageCount: thread.messageCount,
    mcpServerCount: thread.mcpServerCount,
    isAwaitingResponse: (
      options.threadRequestStateById[thread.id] ?? DEFAULT_THREAD_REQUEST_STATE
    ).isSending,
  }));
}

export function mergeSkillSelections(
  threadSkills: ThreadSkillActivation[],
  messageSkillActivations: ThreadSkillActivation[],
): ThreadSkillActivation[] {
  const byLocation = new Map<string, ThreadSkillActivation>();
  for (const selection of [...threadSkills, ...messageSkillActivations]) {
    const location = selection.location.trim();
    if (!location || byLocation.has(location)) {
      continue;
    }

    byLocation.set(location, {
      name: selection.name,
      location,
    });
  }

  return Array.from(byLocation.values());
}

export function findThreadSnapshotById(
  threads: ThreadSnapshot[],
  threadIdRaw: string,
): ThreadSnapshot | null {
  const threadId = threadIdRaw.trim();
  if (!threadId) {
    return null;
  }

  return threads.find((thread) => thread.id === threadId) ?? null;
}
