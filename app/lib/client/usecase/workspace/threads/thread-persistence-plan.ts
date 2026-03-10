import {
  buildThreadSaveSignature,
  hasThreadPersistableState,
} from "~/lib/client/usecase/workspace/threads/thread-save-state";
import type { ThreadState } from "~/lib/client/usecase/workspace/threads/thread-state";

type ReadSavedThreadSignature = (threadId: string) => string | undefined;

type BuildThreadStateFromCurrentState = (
  base: ThreadState,
  options?: {
    includeDraftName?: boolean;
  },
) => ThreadState;

export type ThreadPersistencePlan = {
  snapshot: ThreadState;
  signature: string;
  savedSignature?: string;
  hasSavedSignature: boolean;
};

export function canPersistThreadState(
  snapshot: ThreadState,
  readSavedThreadSignature: ReadSavedThreadSignature,
): boolean {
  if (hasThreadPersistableState(snapshot)) {
    return true;
  }

  return typeof readSavedThreadSignature(snapshot.id) === "string";
}

export function buildThreadPersistencePlan(
  snapshot: ThreadState,
  options: {
    readSavedThreadSignature: ReadSavedThreadSignature;
  },
): ThreadPersistencePlan | null {
  const savedSignature = options.readSavedThreadSignature(snapshot.id);
  const hasSavedSignature = typeof savedSignature === "string";
  if (!hasThreadPersistableState(snapshot) && !hasSavedSignature) {
    return null;
  }

  const signature = buildThreadSaveSignature(snapshot);
  if (savedSignature === signature) {
    return null;
  }

  return {
    snapshot,
    signature,
    savedSignature,
    hasSavedSignature,
  };
}

export function buildThreadPersistencePlanFromCurrentState(options: {
  baseThread: ThreadState;
  buildThreadStateFromCurrentState: BuildThreadStateFromCurrentState;
  readSavedThreadSignature: ReadSavedThreadSignature;
  includeDraftName?: boolean;
  mapSnapshot?: (snapshot: ThreadState) => ThreadState;
}): ThreadPersistencePlan | null {
  const snapshot = options.buildThreadStateFromCurrentState(options.baseThread, {
    includeDraftName: options.includeDraftName === true,
  });
  const nextSnapshot = options.mapSnapshot
    ? options.mapSnapshot(snapshot)
    : snapshot;

  return buildThreadPersistencePlan(nextSnapshot, {
    readSavedThreadSignature: options.readSavedThreadSignature,
  });
}
