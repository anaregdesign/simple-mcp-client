import { buildThreadSaveSignature } from "~/lib/client/usecase/workspace/threads/thread-save-state";
import type { ThreadState } from "~/lib/client/usecase/workspace/threads/thread-state";

export function readSavedThreadSignature(
  signatureMap: Map<string, string>,
  threadId: string,
): string | undefined {
  return signatureMap.get(threadId);
}

export function writeThreadSaveSignature(
  signatureMap: Map<string, string>,
  threadId: string,
  signature: string,
): void {
  signatureMap.set(threadId, signature);
}

export function rememberThreadSaveSignature(
  signatureMap: Map<string, string>,
  thread: ThreadState,
): void {
  writeThreadSaveSignature(signatureMap, thread.id, buildThreadSaveSignature(thread));
}

export function clearThreadSaveSignatures(
  signatureMap: Map<string, string>,
): void {
  signatureMap.clear();
}

export function setThreadSaveSignatures(
  signatureMap: Map<string, string>,
  threads: ThreadState[],
): void {
  clearThreadSaveSignatures(signatureMap);
  for (const thread of threads) {
    rememberThreadSaveSignature(signatureMap, thread);
  }
}
