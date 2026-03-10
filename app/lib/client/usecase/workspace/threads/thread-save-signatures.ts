import { buildThreadSaveSignature } from "~/lib/client/usecase/workspace/threads/thread-save-state";
import type { ThreadState } from "~/lib/client/usecase/workspace/threads/thread-state";

export function readSavedThreadSignature(
  signatureMap: Map<string, string>,
  threadId: string,
): string | undefined {
  return signatureMap.get(threadId);
}

export function rememberThreadSaveSignature(
  signatureMap: Map<string, string>,
  thread: ThreadState,
): void {
  signatureMap.set(thread.id, buildThreadSaveSignature(thread));
}

export function setThreadSaveSignatures(
  signatureMap: Map<string, string>,
  threads: ThreadState[],
): void {
  signatureMap.clear();
  for (const thread of threads) {
    rememberThreadSaveSignature(signatureMap, thread);
  }
}
