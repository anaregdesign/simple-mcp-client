import { THREAD_NAME_MAX_LENGTH } from "~/lib/constants/client";
import type { ThreadState } from "~/lib/client/usecase/workspace/threads/thread-state";

export type ThreadNameMutationDependencies = {
  readActiveThreadId: () => string;
  updateThreadStateById: (
    threadId: string,
    updater: (current: ThreadState) => ThreadState,
  ) => void;
  setActiveThreadNameInput: (value: string) => void;
};

export function applyThreadNameChange(
  deps: ThreadNameMutationDependencies,
  options: {
    threadId: string;
    nextName: string;
  },
): ThreadState | null {
  const normalizedThreadId = options.threadId.trim();
  const normalizedName = options.nextName.trim().slice(0, THREAD_NAME_MAX_LENGTH);
  if (!normalizedThreadId || !normalizedName) {
    return null;
  }

  let renamedThread: ThreadState | null = null;
  deps.updateThreadStateById(normalizedThreadId, (current) => {
    renamedThread = {
      ...current,
      updatedAt: new Date().toISOString(),
      name: normalizedName,
    };
    return renamedThread;
  });

  if (!renamedThread) {
    return null;
  }

  if (normalizedThreadId === deps.readActiveThreadId().trim()) {
    deps.setActiveThreadNameInput(normalizedName);
  }

  return renamedThread;
}
