import type { MutableRefObject } from "react";
import type { ThreadsApiResponse } from "~/lib/client/infrastructure/api/threads-api-client";
import {
  flushActiveThreadState as flushActiveThreadStateOperation,
  saveActiveThreadNameInBackground as saveActiveThreadNameInBackgroundOperation,
  saveThreadStateSilentlyIfNeeded as saveThreadStateSilentlyIfNeededOperation,
  saveThreadStateToDatabase as saveThreadStateToDatabaseOperation,
} from "~/lib/client/usecase/workspace/threads/thread-persistence-operations";
import type { ThreadWritePayload } from "~/lib/contracts/threads/types";
import type { ThreadState } from "~/lib/client/usecase/workspace/threads/thread-state";

type CreateThreadPersistenceControllerOptions = {
  activeWorkspaceUserKeyRef: MutableRefObject<string>;
  activeThreadIdRef: MutableRefObject<string>;
  threadsRef: MutableRefObject<ThreadState[]>;
  readSavedThreadSignature: (threadId: string) => string | undefined;
  writeThreadSaveSignature: (threadId: string, signature: string) => void;
  threadSaveRequestSeqRef: MutableRefObject<number>;
  setIsSavingThread: (value: boolean) => void;
  markAzureAuthRequired: () => void;
  setThreadError: (value: string | null) => void;
  updateThreadsState: (
    updater: (current: ThreadState[]) => ThreadState[],
  ) => ThreadState[];
  setActiveThreadNameInput: (value: string) => void;
  buildThreadStateFromCurrentState: (
    base: ThreadState,
    options?: {
      includeDraftName?: boolean;
    },
  ) => ThreadState;
  clearThreadNameSaveTimeout: () => void;
  clearThreadSaveTimeout: () => void;
  saveThread: (
    payload: ThreadWritePayload,
    options: {
      isUpdate?: boolean;
      onAuthRequired?: () => void;
    },
  ) => Promise<ThreadsApiResponse>;
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

export function createThreadPersistenceController(
  options: CreateThreadPersistenceControllerOptions,
) {
  function buildOperationDeps() {
    return {
      readActiveWorkspaceUserKey: () => options.activeWorkspaceUserKeyRef.current,
      readActiveThreadId: () => options.activeThreadIdRef.current,
      readThreads: () => options.threadsRef.current,
      readSavedThreadSignature: options.readSavedThreadSignature,
      writeThreadSaveSignature: options.writeThreadSaveSignature,
      nextThreadSaveRequestSeq: () => {
        options.threadSaveRequestSeqRef.current += 1;
        return options.threadSaveRequestSeqRef.current;
      },
      readThreadSaveRequestSeq: () => options.threadSaveRequestSeqRef.current,
      setIsSavingThread: options.setIsSavingThread,
      markAzureAuthRequired: options.markAzureAuthRequired,
      setThreadError: options.setThreadError,
      updateThreadsState: options.updateThreadsState,
      setActiveThreadNameInput: options.setActiveThreadNameInput,
      buildThreadStateFromCurrentState: options.buildThreadStateFromCurrentState,
      clearThreadNameSaveTimeout: options.clearThreadNameSaveTimeout,
      clearThreadSaveTimeout: options.clearThreadSaveTimeout,
      saveThread: options.saveThread,
      logClientInfo: options.logClientInfo,
      logClientError: options.logClientError,
    };
  }

  return {
    async saveThreadStateToDatabase(
      thread: ThreadState,
      saveOptions: {
        showBusy?: boolean;
        reportError?: boolean;
      } = {},
    ): Promise<boolean> {
      return await saveThreadStateToDatabaseOperation(
        buildOperationDeps(),
        thread,
        saveOptions,
      );
    },

    async saveThreadStateSilentlyIfNeeded(threadId: string): Promise<void> {
      await saveThreadStateSilentlyIfNeededOperation(
        buildOperationDeps(),
        threadId,
      );
    },

    async flushActiveThreadState(): Promise<boolean> {
      return await flushActiveThreadStateOperation(buildOperationDeps());
    },

    async saveActiveThreadNameInBackground(
      threadId: string,
      name: string,
    ): Promise<void> {
      await saveActiveThreadNameInBackgroundOperation(
        buildOperationDeps(),
        threadId,
        name,
      );
    },
  };
}
