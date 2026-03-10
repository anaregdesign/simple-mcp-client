import type { MutableRefObject } from "react";
import { readThreadEnvironmentFromUnknown } from "~/lib/domain/value-objects/thread-environment";
import {
  cloneThreadEnvironment,
  updateThreadStateCollectionById,
  type ThreadState,
} from "~/lib/client/usecase/workspace/threads/thread-state";
import type { ThreadMessage } from "~/lib/contracts/chat/messages";
import {
  type ThreadOperationLogEntry,
  upsertThreadOperationLogEntry,
} from "~/lib/contracts/chat/operation-log";

type CreateThreadStateUpdatersOptions = {
  threadsRef: MutableRefObject<ThreadState[]>;
  setThreads: (value: ThreadState[]) => void;
};

export function createThreadStateUpdaters(
  options: CreateThreadStateUpdatersOptions,
) {
  function setThreadsState(nextThreads: ThreadState[]): void {
    options.threadsRef.current = nextThreads;
    options.setThreads(nextThreads);
  }

  function updateThreadsState(
    updater: (current: ThreadState[]) => ThreadState[],
  ): ThreadState[] {
    const nextThreads = updater(options.threadsRef.current);
    options.threadsRef.current = nextThreads;
    options.setThreads(nextThreads);
    return nextThreads;
  }

  function updateThreadStateById(
    threadId: string,
    updater: (current: ThreadState) => ThreadState,
  ): void {
    if (!threadId) {
      return;
    }

    updateThreadsState((current) =>
      updateThreadStateCollectionById(current, threadId, updater),
    );
  }

  function appendMessageToThreadState(
    threadId: string,
    message: ThreadMessage,
  ): void {
    const clonedMessage: ThreadMessage = {
      ...message,
      attachments: message.attachments.map((attachment) => ({ ...attachment })),
      skillActivations: message.skillActivations.map((selection) => ({
        ...selection,
      })),
    };

    updateThreadStateById(threadId, (thread) => ({
      ...thread,
      updatedAt: new Date().toISOString(),
      messages: [...thread.messages, clonedMessage],
    }));
  }

  function appendThreadOperationLogToThreadState(
    threadId: string,
    entry: ThreadOperationLogEntry,
  ): void {
    const clonedEntry: ThreadOperationLogEntry = { ...entry };

    updateThreadStateById(threadId, (thread) => ({
      ...thread,
      updatedAt: new Date().toISOString(),
      mcpRpcLogs: upsertThreadOperationLogEntry(thread.mcpRpcLogs, clonedEntry),
    }));
  }

  function applyThreadEnvironmentToThreadState(
    threadId: string,
    environmentValue: unknown,
  ): void {
    if (!threadId) {
      return;
    }

    const nextEnvironment = readThreadEnvironmentFromUnknown(environmentValue);
    updateThreadStateById(threadId, (thread) => ({
      ...thread,
      updatedAt: new Date().toISOString(),
      threadEnvironment: cloneThreadEnvironment(nextEnvironment),
    }));
  }

  return {
    setThreadsState,
    updateThreadsState,
    updateThreadStateById,
    appendMessageToThreadState,
    appendThreadOperationLogToThreadState,
    applyThreadEnvironmentToThreadState,
  };
}
