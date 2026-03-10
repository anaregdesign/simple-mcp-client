import {
  cancelThreadProcessing,
  clearThread,
  createThreadAndSwitch,
  deleteThread,
  renameThread,
  restoreThread,
  switchThread,
} from "~/lib/client/usecase/workspace/threads/thread-lifecycle-operations";
import type {
  ThreadLifecycleHandlerDependencies,
  ThreadLifecycleHandlers,
} from "~/lib/client/usecase/workspace/threads/thread-lifecycle-types";

export function createThreadLifecycleHandlers(
  deps: ThreadLifecycleHandlerDependencies,
): ThreadLifecycleHandlers {
  return {
    async handleCreateThread() {
      const created = await createThreadAndSwitch(deps, {
        name: "",
      });
      if (created) {
        deps.setActiveMainTab("threads");
      }
    },

    async handleThreadRename(
      threadIdRaw: string,
      nextNameRaw: string,
    ): Promise<void> {
      await renameThread(deps, threadIdRaw, nextNameRaw);
    },

    handleThreadCancel(threadIdRaw: string): void {
      cancelThreadProcessing(deps, threadIdRaw);
    },

    async handleThreadClear(threadIdRaw: string): Promise<void> {
      await clearThread(deps, threadIdRaw);
    },

    async handleThreadLogicalDelete(threadIdRaw: string): Promise<void> {
      await deleteThread(deps, threadIdRaw);
    },

    async handleThreadRestore(threadIdRaw: string): Promise<void> {
      await restoreThread(deps, threadIdRaw);
    },

    async handleThreadChange(nextThreadIdRaw: string): Promise<void> {
      await switchThread(deps, nextThreadIdRaw);
    },
  };
}
