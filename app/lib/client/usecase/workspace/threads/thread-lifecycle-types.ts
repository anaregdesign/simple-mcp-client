import type { MainViewTab } from "~/lib/client/usecase/workspace/view-types";
import type { ThreadOperationPhase } from "~/lib/client/usecase/workspace/threads/thread-operation-phase";
import type { ThreadRequestState } from "~/lib/client/usecase/workspace/types";
import type { ThreadState } from "~/lib/contracts/threads/types";

export type ThreadLifecycleLogOptions = {
  category?: string;
  location?: string;
  action?: string;
  statusCode?: number;
  context?: Record<string, unknown>;
};

export type ThreadLifecycleHandlerDependencies = {
  isSending: boolean;
  threadOperationPhase: ThreadOperationPhase;
  readThreads: () => ThreadState[];
  readActiveThreadId: () => string;
  beginThreadOperation: (
    phase: Exclude<ThreadOperationPhase, "idle">,
  ) => boolean;
  endThreadOperation: (
    expectedPhase: Exclude<ThreadOperationPhase, "idle">,
  ) => void;
  readThreadRequestState: (threadId: string) => ThreadRequestState;
  updateThreadStateById: (
    threadId: string,
    updater: (current: ThreadState) => ThreadState,
  ) => void;
  updateThreadsState: (
    updater: (current: ThreadState[]) => ThreadState[],
  ) => ThreadState[];
  hasSavedThreadSignature: (threadId: string) => boolean;
  setThreadsReady: () => void;
  rememberThreadSaveSignature: (thread: ThreadState) => void;
  applyThreadState: (thread: ThreadState) => void;
  clearActiveThreadState: () => void;
  buildThreadStateFromCurrentState: (
    base: ThreadState,
    options?: {
      includeDraftName?: boolean;
    },
  ) => ThreadState;
  saveThreadStateToDatabase: (
    thread: ThreadState,
    signature: string,
  ) => Promise<boolean>;
  flushActiveThreadState: () => Promise<boolean>;
  cancelThreadInProgressProcessing: (threadId: string) => boolean;
  createLocalThreadState: (options?: { name?: string }) => ThreadState;
  loadThreads: () => Promise<void>;
  removeThreadRequestState: (threadId: string) => void;
  setThreadError: (message: string | null) => void;
  setSystemNotice: (message: string | null) => void;
  setActiveMainTab: (tab: MainViewTab) => void;
  setActiveThreadNameInput: (name: string) => void;
  markAzureAuthRequired: () => void;
  logClientInfo: (
    eventName: string,
    message: string,
    options?: ThreadLifecycleLogOptions,
  ) => void;
  logClientError: (
    eventName: string,
    error: unknown,
    options?: ThreadLifecycleLogOptions,
  ) => void;
};

export type ThreadLifecycleHandlers = {
  handleCreateThread: () => Promise<void>;
  handleThreadRename: (
    threadIdRaw: string,
    nextNameRaw: string,
  ) => Promise<void>;
  handleThreadCancel: (threadIdRaw: string) => void;
  handleThreadClear: (threadIdRaw: string) => Promise<void>;
  handleThreadLogicalDelete: (threadIdRaw: string) => Promise<void>;
  handleThreadRestore: (threadIdRaw: string) => Promise<void>;
  handleThreadChange: (nextThreadIdRaw: string) => Promise<void>;
};
