import type { MutableRefObject } from "react";
import type { ThreadsApiResponse } from "~/lib/client/infrastructure/api/threads-api-client";
import {
  loadThreads as loadThreadsOperation,
} from "~/lib/client/usecase/workspace/thread-loading-operations";
import type { ThreadState } from "~/lib/contracts/threads/types";

type CreateThreadLoadingControllerOptions = {
  activeWorkspaceUserKeyRef: MutableRefObject<string>;
  activeThreadIdRef: MutableRefObject<string>;
  threadLoadRequestSeqRef: MutableRefObject<number>;
  isThreadsReadyRef: MutableRefObject<boolean>;
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
      readActiveWorkspaceUserKey: () => options.activeWorkspaceUserKeyRef.current,
      clearThreadsState: options.clearThreadsState,
      nextThreadLoadRequestSeq: () => {
        options.threadLoadRequestSeqRef.current += 1;
        return options.threadLoadRequestSeqRef.current;
      },
      readThreadLoadRequestSeq: () => options.threadLoadRequestSeqRef.current,
      beginThreadOperation: options.beginLoadingThreadOperation,
      endThreadOperation: options.endLoadingThreadOperation,
      setThreadError: options.setThreadError,
      loadThreads: options.loadThreads,
      markAzureAuthRequired: options.markAzureAuthRequired,
      setThreadSaveSignatures: options.setThreadSaveSignatures,
      setThreadsState: options.setThreadsState,
      pruneThreadRequestState: options.pruneThreadRequestState,
      setThreadsReady: () => {
        options.isThreadsReadyRef.current = true;
      },
      readPreferredThreadId: () => options.activeThreadIdRef.current,
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
