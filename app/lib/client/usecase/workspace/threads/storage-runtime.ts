import {
  threadsApiClient,
} from "~/lib/client/infrastructure/api/threads-api-client";
import {
  createThreadLoadingController,
} from "~/lib/client/usecase/workspace/threads/thread-loading-controller";
import {
  createThreadPersistenceController,
} from "~/lib/client/usecase/workspace/threads/thread-persistence-controller";
import type { ThreadState } from "~/lib/client/usecase/workspace/threads/thread-state";

type ThreadPersistenceControllerOptions =
  Parameters<typeof createThreadPersistenceController>[0];
type ThreadLoadingControllerOptions =
  Parameters<typeof createThreadLoadingController>[0];

type CreateThreadStorageRuntimeOptions = {
  persistence: Omit<ThreadPersistenceControllerOptions, "saveThread">;
  loading: Omit<ThreadLoadingControllerOptions, "loadThreads">;
};

export function createThreadStorageRuntime(
  options: CreateThreadStorageRuntimeOptions,
) {
  const threadPersistenceController = createThreadPersistenceController({
    ...options.persistence,
    saveThread: (payload, saveOptions) =>
      threadsApiClient.saveThread(payload, saveOptions),
  });
  const threadLoadingController = createThreadLoadingController({
    ...options.loading,
    loadThreads: (loadOptions) => threadsApiClient.loadThreads(loadOptions),
  });

  return {
    async saveThreadStateToDatabase(
      thread: ThreadState,
      saveOptions: {
        showBusy?: boolean;
        reportError?: boolean;
      } = {},
    ): Promise<boolean> {
      return await threadPersistenceController.saveThreadStateToDatabase(
        thread,
        saveOptions,
      );
    },

    async saveThreadStateSilentlyIfNeeded(threadId: string): Promise<void> {
      await threadPersistenceController.saveThreadStateSilentlyIfNeeded(threadId);
    },

    scheduleThreadStateSave(threadId: string): void {
      queueMicrotask(() => {
        void threadPersistenceController.saveThreadStateSilentlyIfNeeded(
          threadId,
        );
      });
    },

    async flushActiveThreadState(): Promise<boolean> {
      return await threadPersistenceController.flushActiveThreadState();
    },

    async saveActiveThreadNameInBackground(
      threadId: string,
      name: string,
    ): Promise<void> {
      await threadPersistenceController.saveActiveThreadNameInBackground(
        threadId,
        name,
      );
    },

    async loadThreads(): Promise<void> {
      await threadLoadingController.loadThreads();
    },
  };
}
