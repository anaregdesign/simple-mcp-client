import { INITIAL_THREAD_MESSAGES } from "~/lib/constants/client";
import {
  isThreadArchived,
  readThreadRuntimeStateById,
  type ThreadState,
} from "~/lib/client/usecase/workspace/threads/thread-state";
import { buildThreadSummary } from "~/lib/client/usecase/workspace/threads/thread-state-mappers";
import type { ThreadRequestState } from "~/lib/client/usecase/workspace/types";
import {
  buildThreadListOptions,
  type ThreadListOption,
} from "~/lib/client/usecase/workspace/threads/thread-runtime";

export type ThreadViewModel = {
  activeThreadState: ThreadState | null;
  messages: ThreadState["messages"];
  mcpServers: ThreadState["mcpServers"];
  mcpRpcLogs: ThreadState["mcpRpcLogs"];
  selectedThreadSkills: ThreadState["skillSelections"];
  isActiveThreadArchived: boolean;
  activeThreadOptions: ThreadListOption[];
  archivedThreadOptions: ThreadListOption[];
};

export function selectThreadViewModel(options: {
  threads: ThreadState[];
  activeThreadId: string;
  activeThreadNameInput: string;
  threadRequestStateById: Record<string, ThreadRequestState>;
}): ThreadViewModel {
  const activeThreadRuntimeState = readThreadRuntimeStateById(
    options.threads,
    options.activeThreadId,
  );
  const activeThreadState = activeThreadRuntimeState.activeThreadState;
  const messages =
    activeThreadState !== null
      ? activeThreadRuntimeState.messages
      : [...INITIAL_THREAD_MESSAGES];
  const threadSummaries = options.threads.map((thread) =>
    buildThreadSummary(thread),
  );
  const activeThreadOptions = buildThreadListOptions({
    summaries: threadSummaries.filter((thread) => thread.deletedAt === null),
    threadRequestStateById: options.threadRequestStateById,
    renameActiveThreadId: options.activeThreadId,
    activeThreadNameInput: options.activeThreadNameInput,
  });
  const archivedThreadOptions = buildThreadListOptions({
    summaries: threadSummaries.filter((thread) => thread.deletedAt !== null),
    threadRequestStateById: options.threadRequestStateById,
  });

  return {
    activeThreadState,
    messages,
    mcpServers: activeThreadRuntimeState.mcpServers,
    mcpRpcLogs: activeThreadRuntimeState.mcpRpcLogs,
    selectedThreadSkills: activeThreadRuntimeState.skillSelections,
    isActiveThreadArchived: isThreadArchived(activeThreadState),
    activeThreadOptions,
    archivedThreadOptions,
  };
}
