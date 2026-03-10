import type { ThreadsApiResponse } from "~/lib/client/infrastructure/api/threads-api-client";
import {
  loadThreads as loadThreadsOperation,
} from "~/lib/client/usecase/workspace/threads/thread-loading-operations";
import type { ThreadState } from "~/lib/client/usecase/workspace/threads/thread-state";

type CreateThreadLoadingControllerOptions = {
  readActiveWorkspaceUserKey: () => string;
  readPreferredThreadId: () => string;
  nextThreadLoadRequestSeq: () => number;
  readThreadLoadRequestSeq: () => number;
  setThreadsReady: () => void;
  clearThreadsState: (nextError?: string | null) => void;
  beginLoadingThreadOperation: () => boolean;
  endLoadingThreadOperation: () => void;
  setThreadError: (value: string | null) => void;
  loadThreads: (options: {
    onAuthRequired?: () => void;
  }) => Promise<ThreadsApiResponse>;
  markAzureAuthRequired: () => void;
  setThreadSaveSignatures: (nextThreads: ThreadState[]) => void;
  setThreadsState: (nextThreads: ThreadState[]) => void;
  pruneThreadRequestState: (validThreadIds: string[]) => void;
  applyThreadState: (thread: ThreadState) => void;
  createLocalThreadState: () => ThreadState;
  logClientInfo: (
    eventName: string,
    message: string,
    options?: {
      category?: string;
      location?: string;
      action?: string;
      statusCode?: number;
      context?: Record<string, unknown>;
    },
  ) => void;
  logClientError: (
    eventName: string,
    error: unknown,
    options?: {
      category?: string;
      location?: string;
      action?: string;
      statusCode?: number;
      context?: Record<string, unknown>;
    },
  ) => void;
};

export function createThreadLoadingController(
  options: CreateThreadLoadingControllerOptions,
) {
  function buildOperationDeps() {
    return {
      readActiveWorkspaceUserKey: options.readActiveWorkspaceUserKey,
      clearThreadsState: options.clearThreadsState,
      nextThreadLoadRequestSeq: options.nextThreadLoadRequestSeq,
      readThreadLoadRequestSeq: options.readThreadLoadRequestSeq,
      beginThreadOperation: options.beginLoadingThreadOperation,
      endThreadOperation: options.endLoadingThreadOperation,
      setThreadError: options.setThreadError,
      loadThreads: options.loadThreads,
      markAzureAuthRequired: options.markAzureAuthRequired,
      setThreadSaveSignatures: options.setThreadSaveSignatures,
      setThreadsState: options.setThreadsState,
      pruneThreadRequestState: options.pruneThreadRequestState,
      setThreadsReady: options.setThreadsReady,
      readPreferredThreadId: options.readPreferredThreadId,
      applyThreadState: options.applyThreadState,
      createLocalThreadState: options.createLocalThreadState,
      logClientInfo: options.logClientInfo,
      logClientError: options.logClientError,
    };
  }

  return {
    async loadThreads(): Promise<void> {
      await loadThreadsOperation(buildOperationDeps());
    },
  };
}
