import { useEffect, useRef, useState, type Dispatch } from "react";
import {
  DEFAULT_REASONING_EFFORT,
  DEFAULT_WEB_SEARCH_ENABLED,
} from "~/lib/domain/value-objects/thread-defaults";
import {
  clearThreadTimeout,
  deferAppliedThreadStateReset,
  scheduleThreadTimeout,
} from "~/lib/client/infrastructure/browser/threads";
import type { McpServerConfig } from "~/lib/contracts/mcp/profile";
import {
  isThreadArchivedById,
  type ThreadState,
} from "~/lib/client/usecase/workspace/threads/thread-state";
import { createRuntimeId } from "~/lib/client/usecase/workspace/runtime-id";
import type { WorkspaceInteractionAction } from "~/lib/client/usecase/workspace/reducer";
import {
  buildThreadStateFromCurrentState as buildThreadStateFromCurrentStateOperation,
  createLocalThreadState as createLocalThreadStateOperation,
} from "./local-thread-state";
import {
  clearThreadSaveSignatures as clearThreadSaveSignaturesOperation,
  readSavedThreadSignature as readSavedThreadSignatureOperation,
  rememberThreadSaveSignature as rememberThreadSaveSignatureOperation,
  setThreadSaveSignatures as setThreadSaveSignaturesOperation,
  writeThreadSaveSignature as writeThreadSaveSignatureOperation,
} from "./thread-save-signatures";
import { createThreadRequestStateController } from "./thread-request-state-controller";
import { createThreadStateUpdaters } from "./state-updaters";
import type { ThreadRequestState } from "./thread-request-state";
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
    clearThreadTimeout(threadNameSaveTimeoutRef);
  }

  function clearThreadTitleRefreshTimeout() {
    clearThreadTimeout(threadTitleRefreshTimeoutRef);
  }

  function clearThreadSaveTimeout() {
    clearThreadTimeout(threadSaveTimeoutRef);
  }

  function scheduleThreadNameSaveTimeout(onElapsed: () => void): void {
    scheduleThreadTimeout({
      timeoutRef: threadNameSaveTimeoutRef,
      delayMs: 3000,
      onElapsed,
    });
  }

  function scheduleThreadTitleRefreshTimeout(onElapsed: () => void): void {
    scheduleThreadTimeout({
      timeoutRef: threadTitleRefreshTimeoutRef,
      delayMs: 1000,
      onElapsed,
    });
  }

  function scheduleThreadSaveTimeout(onElapsed: () => void): void {
    scheduleThreadTimeout({
      timeoutRef: threadSaveTimeoutRef,
      delayMs: 450,
      onElapsed,
    });
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
    clearThreadSaveSignaturesOperation(threadSaveSignatureByIdRef.current);
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

  function createLocalThreadState(
    createOptions: {
      name?: string;
    } = {},
  ): ThreadState {
    return createLocalThreadStateOperation({
      ...createOptions,
      defaultThreadMcpServers: options.readDefaultThreadMcpServers(),
      createThreadId: () => createRuntimeId("thread"),
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

  function readSavedThreadSignature(threadId: string): string | undefined {
    return readSavedThreadSignatureOperation(
      threadSaveSignatureByIdRef.current,
      threadId,
    );
  }

  function rememberThreadSaveSignature(thread: ThreadState): void {
    rememberThreadSaveSignatureOperation(threadSaveSignatureByIdRef.current, thread);
  }

  function writeThreadSaveSignature(threadId: string, signature: string): void {
    writeThreadSaveSignatureOperation(
      threadSaveSignatureByIdRef.current,
      threadId,
      signature,
    );
  }

  function applyThreadState(thread: ThreadState) {
    isApplyingThreadStateRef.current = true;

    activeThreadIdRef.current = thread.id;
    setActiveThreadId(thread.id);
    setActiveThreadNameInput(thread.name);
    options.applyThreadPlaygroundState(thread);
    options.applyThreadInstructionState(thread);

    deferAppliedThreadStateReset(() => {
      isApplyingThreadStateRef.current = false;
    });
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
    setThreadsReady();
    setThreadsState([localThread]);
    options.dispatchWorkspaceInteraction({
      type: "thread_request_state/reset_all",
    });
    applyThreadState(localThread);
    setThreadError(null);
    beginThreadOperation("loading");
  }

  function nextThreadLoadRequestSeq(): number {
    threadLoadRequestSeqRef.current += 1;
    return threadLoadRequestSeqRef.current;
  }

  function nextThreadSaveRequestSeq(): number {
    threadSaveRequestSeqRef.current += 1;
    return threadSaveRequestSeqRef.current;
  }

  function readThreadLoadRequestSeq(): number {
    return threadLoadRequestSeqRef.current;
  }

  function readThreadSaveRequestSeq(): number {
    return threadSaveRequestSeqRef.current;
  }

  function readActiveThreadNameInput(): string {
    return activeThreadNameInputRef.current;
  }

  function readIsThreadsReady(): boolean {
    return isThreadsReadyRef.current;
  }

  function readIsApplyingThreadState(): boolean {
    return isApplyingThreadStateRef.current;
  }

  function setThreadsReady(): void {
    isThreadsReadyRef.current = true;
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
    isSavingThread,
    setIsSavingThread,
    threadOperationPhase,
    setThreadOperationPhase,
    threadError,
    setThreadError,
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
    scheduleThreadNameSaveTimeout,
    scheduleThreadTitleRefreshTimeout,
    scheduleThreadSaveTimeout,
    clearThreadsState,
    beginThreadOperation,
    resetThreadOperationPhase,
    endThreadOperation,
    isArchivedThread,
    createLocalThreadState,
    buildThreadStateFromCurrentState,
    nextThreadLoadRequestSeq,
    nextThreadSaveRequestSeq,
    readThreadLoadRequestSeq,
    readThreadSaveRequestSeq,
    readActiveThreadNameInput,
    readIsThreadsReady,
    readIsApplyingThreadState,
    readSavedThreadSignature,
    rememberThreadSaveSignature,
    writeThreadSaveSignature,
    setThreadsReady,
    setThreadSaveSignatures,
    applyThreadState,
    clearActiveThreadState,
    showThreadReloadPlaceholder,
  };
}
