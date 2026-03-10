import { useEffect, useRef, useState, type Dispatch } from "react";
import {
  DEFAULT_REASONING_EFFORT,
  DEFAULT_WEB_SEARCH_ENABLED,
} from "~/lib/domain/value-objects/thread-defaults";
import type { McpServerConfig } from "~/lib/contracts/mcp/profile";
import { isThreadArchivedById } from "~/lib/contracts/threads/state";
import type { ThreadState } from "~/lib/contracts/threads/types";
import { createId } from "~/lib/client/usecase/workspace/ids";
import type { ThreadRequestState } from "~/lib/client/usecase/workspace/types";
import type { WorkspaceInteractionAction } from "~/lib/client/usecase/workspace/reducer";
import {
  buildThreadStateFromCurrentState as buildThreadStateFromCurrentStateOperation,
  createLocalThreadState as createLocalThreadStateOperation,
  setThreadSaveSignatures as setThreadSaveSignaturesOperation,
  shouldPersistThreadState as shouldPersistThreadStateOperation,
} from "./local-thread-state";
import { createThreadRequestStateController } from "./request-state";
import { createThreadStateUpdaters } from "./state-updaters";
import {
  canTransition,
  transitionThreadOperation,
  type ThreadOperationPhase,
} from "./thread-operation-phase";

type UseThreadShellOptions = {
  threadRequestStateById: Record<string, ThreadRequestState>;
  dispatchWorkspaceInteraction: Dispatch<WorkspaceInteractionAction>;
  readDefaultThreadMcpServers: () => McpServerConfig[];
  readCurrentThreadDraftState: () => {
    reasoningEffort: ThreadState["reasoningEffort"];
    webSearchEnabled: boolean;
    chatAzureConfig: ThreadState["chatAzureConfig"];
    agentInstruction: string;
    instructionContextToggles: ThreadState["instructionContextToggles"];
    messages: ThreadState["messages"];
    mcpServers: ThreadState["mcpServers"];
    mcpRpcLogs: ThreadState["mcpRpcLogs"];
    selectedThreadSkills: ThreadState["skillSelections"];
  };
  resetPlaygroundSession: () => void;
  applyThreadPlaygroundState: (
    thread: Pick<
      ThreadState,
      "reasoningEffort" | "webSearchEnabled" | "chatAzureConfig"
    >,
  ) => void;
  resetInstructionEditor: () => void;
  applyThreadInstructionState: (
    thread: Pick<ThreadState, "agentInstruction" | "instructionContextToggles">,
  ) => void;
};

export function useThreadShell(options: UseThreadShellOptions) {
  const [threads, setThreads] = useState<ThreadState[]>([]);
  const [activeThreadId, setActiveThreadId] = useState("");
  const [activeThreadNameInput, setActiveThreadNameInput] = useState("");
  const [isSavingThread, setIsSavingThread] = useState(false);
  const [threadOperationPhase, setThreadOperationPhase] =
    useState<ThreadOperationPhase>("idle");
  const [threadError, setThreadError] = useState<string | null>(null);

  const activeThreadIdRef = useRef("");
  const activeThreadNameInputRef = useRef("");
  const isApplyingThreadStateRef = useRef(false);
  const isThreadsReadyRef = useRef(false);
  const threadNameSaveTimeoutRef = useRef<number | null>(null);
  const threadSaveTimeoutRef = useRef<number | null>(null);
  const threadTitleRefreshTimeoutRef = useRef<number | null>(null);
  const threadLoadRequestSeqRef = useRef(0);
  const threadSaveRequestSeqRef = useRef(0);
  const threadSaveSignatureByIdRef = useRef(new Map<string, string>());
  const threadRequestStateByIdRef = useRef<Record<string, ThreadRequestState>>(
    {},
  );
  const threadSendAbortControllerByIdRef = useRef(
    new Map<string, AbortController>(),
  );
  const threadsRef = useRef<ThreadState[]>([]);

  useEffect(() => {
    activeThreadIdRef.current = activeThreadId;
  }, [activeThreadId]);

  useEffect(() => {
    activeThreadNameInputRef.current = activeThreadNameInput;
  }, [activeThreadNameInput]);

  useEffect(() => {
    threadRequestStateByIdRef.current = options.threadRequestStateById;
  }, [options.threadRequestStateById]);

  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);

  function clearThreadNameSaveTimeout() {
    const timeoutId = threadNameSaveTimeoutRef.current;
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
      threadNameSaveTimeoutRef.current = null;
    }
  }

  function clearThreadTitleRefreshTimeout() {
    const timeoutId = threadTitleRefreshTimeoutRef.current;
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
      threadTitleRefreshTimeoutRef.current = null;
    }
  }

  function clearThreadSaveTimeout() {
    const timeoutId = threadSaveTimeoutRef.current;
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
      threadSaveTimeoutRef.current = null;
    }
  }

  const {
    setThreadsState,
    updateThreadsState,
    updateThreadStateById,
    appendMessageToThreadState,
    appendThreadOperationLogToThreadState,
    applyThreadEnvironmentToThreadState,
  } = createThreadStateUpdaters({
    threadsRef,
    setThreads,
  });

  function beginThreadOperation(
    phase: Exclude<ThreadOperationPhase, "idle">,
  ): boolean {
    if (
      !canTransition(threadOperationPhase, {
        type: "start",
        phase,
      })
    ) {
      return false;
    }

    setThreadOperationPhase(
      (current) =>
        transitionThreadOperation(current, {
          type: "start",
          phase,
        }).to,
    );
    return true;
  }

  function resetThreadOperationPhase(): void {
    setThreadOperationPhase(
      (current) =>
        transitionThreadOperation(current, {
          type: "reset",
        }).to,
    );
  }

  function endThreadOperation(
    expectedPhase: Exclude<ThreadOperationPhase, "idle">,
  ): void {
    setThreadOperationPhase(
      (current) =>
        transitionThreadOperation(current, {
          type: "complete",
          phase: expectedPhase,
        }).to,
    );
  }

  const {
    readThreadRequestState,
    updateThreadRequestState,
    assignThreadSendAbortController,
    clearThreadSendAbortController,
    cancelThreadInProgressProcessing,
    appendThreadProgressMessage,
  } = createThreadRequestStateController({
    threadRequestStateByIdRef,
    threadSendAbortControllerByIdRef,
    dispatchWorkspaceInteraction: options.dispatchWorkspaceInteraction,
  });

  function clearThreadsState(nextError: string | null = null) {
    clearThreadTitleRefreshTimeout();
    clearThreadNameSaveTimeout();
    clearThreadSaveTimeout();
    for (const abortController of threadSendAbortControllerByIdRef.current.values()) {
      abortController.abort();
    }
    threadSendAbortControllerByIdRef.current.clear();
    isThreadsReadyRef.current = false;
    activeThreadIdRef.current = "";
    isApplyingThreadStateRef.current = false;
    threadSaveSignatureByIdRef.current.clear();
    setThreadsState([]);
    setActiveThreadId("");
    setActiveThreadNameInput("");
    setThreadError(nextError);
    resetThreadOperationPhase();
    setIsSavingThread(false);
    options.resetPlaygroundSession();
    options.resetInstructionEditor();
    options.dispatchWorkspaceInteraction({
      type: "thread_request_state/reset_all",
    });
  }

  function isArchivedThread(threadIdRaw: string): boolean {
    return isThreadArchivedById(threadsRef.current, threadIdRaw);
  }

  function shouldPersistThreadState(
    thread: Pick<
      ThreadState,
      | "id"
      | "messages"
      | "reasoningEffort"
      | "webSearchEnabled"
      | "chatAzureConfig"
      | "agentInstruction"
      | "instructionContextToggles"
      | "threadEnvironment"
    > &
      Partial<Pick<ThreadState, "skillSelections">>,
  ): boolean {
    return shouldPersistThreadStateOperation(
      thread,
      threadSaveSignatureByIdRef.current,
    );
  }

  function createLocalThreadState(
    createOptions: {
      name?: string;
    } = {},
  ): ThreadState {
    return createLocalThreadStateOperation({
      ...createOptions,
      defaultThreadMcpServers: options.readDefaultThreadMcpServers(),
      createThreadId: () => createId("thread"),
    });
  }

  function buildThreadStateFromCurrentState(
    base: ThreadState,
    buildOptions: {
      includeDraftName?: boolean;
    } = {},
  ): ThreadState {
    const snapshot = options.readCurrentThreadDraftState();
    return buildThreadStateFromCurrentStateOperation(base, {
      includeDraftName: buildOptions.includeDraftName,
      activeThreadNameInput,
      reasoningEffort: snapshot.reasoningEffort,
      webSearchEnabled: snapshot.webSearchEnabled,
      chatAzureConfig: snapshot.chatAzureConfig,
      agentInstruction: snapshot.agentInstruction,
      instructionContextToggles: snapshot.instructionContextToggles,
      messages: snapshot.messages,
      mcpServers: snapshot.mcpServers,
      mcpRpcLogs: snapshot.mcpRpcLogs,
      selectedThreadSkills: snapshot.selectedThreadSkills,
    });
  }

  function setThreadSaveSignatures(nextThreads: ThreadState[]) {
    setThreadSaveSignaturesOperation(
      threadSaveSignatureByIdRef.current,
      nextThreads,
    );
  }

  function applyThreadState(thread: ThreadState) {
    isApplyingThreadStateRef.current = true;

    activeThreadIdRef.current = thread.id;
    setActiveThreadId(thread.id);
    setActiveThreadNameInput(thread.name);
    options.applyThreadPlaygroundState(thread);
    options.applyThreadInstructionState(thread);

    window.setTimeout(() => {
      isApplyingThreadStateRef.current = false;
    }, 0);
  }

  function clearActiveThreadState() {
    activeThreadIdRef.current = "";
    setActiveThreadId("");
    setActiveThreadNameInput("");
    options.resetPlaygroundSession();
    options.resetInstructionEditor();
  }

  function showThreadReloadPlaceholder(): void {
    const localThread = createLocalThreadState();
    isThreadsReadyRef.current = true;
    setThreadsState([localThread]);
    options.dispatchWorkspaceInteraction({
      type: "thread_request_state/reset_all",
    });
    applyThreadState(localThread);
    setThreadError(null);
    beginThreadOperation("loading");
  }

  return {
    threads,
    setThreads,
    threadsRef,
    activeThreadId,
    setActiveThreadId,
    activeThreadIdRef,
    activeThreadNameInput,
    setActiveThreadNameInput,
    activeThreadNameInputRef,
    isSavingThread,
    setIsSavingThread,
    threadOperationPhase,
    setThreadOperationPhase,
    threadError,
    setThreadError,
    isApplyingThreadStateRef,
    isThreadsReadyRef,
    threadNameSaveTimeoutRef,
    threadSaveTimeoutRef,
    threadTitleRefreshTimeoutRef,
    threadLoadRequestSeqRef,
    threadSaveRequestSeqRef,
    threadSaveSignatureByIdRef,
    threadRequestStateByIdRef,
    threadSendAbortControllerByIdRef,
    setThreadsState,
    updateThreadsState,
    updateThreadStateById,
    appendMessageToThreadState,
    appendThreadOperationLogToThreadState,
    applyThreadEnvironmentToThreadState,
    readThreadRequestState,
    updateThreadRequestState,
    assignThreadSendAbortController,
    clearThreadSendAbortController,
    cancelThreadInProgressProcessing,
    appendThreadProgressMessage,
    clearThreadNameSaveTimeout,
    clearThreadTitleRefreshTimeout,
    clearThreadSaveTimeout,
    clearThreadsState,
    beginThreadOperation,
    resetThreadOperationPhase,
    endThreadOperation,
    isArchivedThread,
    shouldPersistThreadState,
    createLocalThreadState,
    buildThreadStateFromCurrentState,
    setThreadSaveSignatures,
    applyThreadState,
    clearActiveThreadState,
    showThreadReloadPlaceholder,
  };
}
