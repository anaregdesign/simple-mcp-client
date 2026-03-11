import { ClientApiError, mapApiError } from "~/lib/client/infrastructure/api/api-client";
import type { ThreadsApiResponse } from "~/lib/client/infrastructure/api/threads-api-client";
import {
  readThreadStateListFromResources,
} from "~/lib/client/usecase/workspace/threads/thread-state-mappers";
import {
  type ThreadState,
  upsertThreadState,
} from "~/lib/client/usecase/workspace/threads/thread-state";
import { DEFAULT_AGENT_INSTRUCTION } from "~/lib/domain/value-objects/thread-defaults";

type ThreadLoadingLogOptions = {
  category?: string;
  location?: string;
  action?: string;
  statusCode?: number;
  context?: Record<string, unknown>;
};

type ThreadLoadingDependencies = {
  readActiveWorkspaceUserKey: () => string;
  clearThreadsState: (nextError?: string | null) => void;
  nextThreadLoadRequestSeq: () => number;
  readThreadLoadRequestSeq: () => number;
  beginThreadOperation: () => boolean;
  endThreadOperation: () => void;
  setThreadError: (value: string | null) => void;
  loadThreads: (options: {
    onAuthRequired?: () => void;
  }) => Promise<ThreadsApiResponse>;
  markAzureAuthRequired: () => void;
  setThreadSaveSignatures: (threads: ThreadState[]) => void;
  setThreadsState: (threads: ThreadState[]) => void;
  pruneThreadRequestState: (validThreadIds: string[]) => void;
  setThreadsReady: () => void;
  readPreferredThreadId: () => string;
  applyThreadState: (thread: ThreadState) => void;
  createLocalThreadState: () => ThreadState;
  logClientInfo: (
    eventName: string,
    message: string,
    options?: ThreadLoadingLogOptions,
  ) => void;
  logClientError: (
    eventName: string,
    error: unknown,
    options?: ThreadLoadingLogOptions,
  ) => void;
};

export async function loadThreads(
  deps: ThreadLoadingDependencies,
): Promise<void> {
  const expectedUserKey = deps.readActiveWorkspaceUserKey().trim();
  if (!expectedUserKey) {
    deps.clearThreadsState();
    return;
  }

  const requestSeq = deps.nextThreadLoadRequestSeq();
  deps.beginThreadOperation();
  deps.setThreadError(null);

  try {
    const payload = await deps.loadThreads({
      onAuthRequired: () => {
        deps.markAzureAuthRequired();
        deps.clearThreadsState(
          "Azure login is required. Open Settings and sign in to load threads.",
        );
      },
    });

    if (requestSeq !== deps.readThreadLoadRequestSeq()) {
      return;
    }
    if (expectedUserKey !== deps.readActiveWorkspaceUserKey().trim()) {
      return;
    }

    const parsedThreads = readThreadStateListFromResources(payload.threads, {
      fallbackInstruction: DEFAULT_AGENT_INSTRUCTION,
    });
    const nextThreads = parsedThreads.some((thread) => thread.deletedAt === null)
      ? parsedThreads
      : upsertThreadState(parsedThreads, deps.createLocalThreadState());

    deps.setThreadSaveSignatures(parsedThreads);
    deps.setThreadsState(nextThreads);
    deps.pruneThreadRequestState(nextThreads.map((thread) => thread.id));
    deps.setThreadsReady();
    deps.setThreadError(null);

    const preferredThreadId = deps.readPreferredThreadId().trim();
    const nextThread =
      nextThreads.find((thread) => thread.id === preferredThreadId) ??
      nextThreads.find((thread) => thread.deletedAt === null) ??
      nextThreads[0];
    if (!nextThread) {
      throw new Error("No thread is available.");
    }

    deps.applyThreadState(nextThread);
    deps.logClientInfo("load_threads_succeeded", "Threads loaded.", {
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
    if (requestSeq !== deps.readThreadLoadRequestSeq()) {
      return;
    }
    if (expectedUserKey !== deps.readActiveWorkspaceUserKey().trim()) {
      return;
    }
    if (loadError instanceof ClientApiError && loadError.kind === "auth_required") {
      return;
    }

    deps.logClientError("load_threads_failed", loadError, {
      action: "load_threads",
      statusCode: 500,
    });
    deps.setThreadError(mapApiError(loadError, "Failed to load threads."));
  } finally {
    if (requestSeq === deps.readThreadLoadRequestSeq()) {
      deps.endThreadOperation();
    }
  }
}
