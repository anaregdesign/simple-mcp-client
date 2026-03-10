import { describe, expect, it } from "vitest";
import {
  clearThreadSaveSignatures,
  readSavedThreadSignature,
  rememberThreadSaveSignature,
  setThreadSaveSignatures,
  writeThreadSaveSignature,
} from "~/lib/client/usecase/workspace/threads/thread-save-signatures";
import type { ThreadState } from "~/lib/client/usecase/workspace/threads/thread-state";

function createThreadState(overrides: Partial<ThreadState> = {}): ThreadState {
  return {
    id: "thread-1",
    name: "Thread 1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    reasoningEffort: "high",
    webSearchEnabled: false,
    chatAzureConfig: null,
    agentConversationId: null,
    agentInstruction: "Instruction",
    instructionContextToggles: {
      system: true,
    },
    threadEnvironment: {},
    messages: [],
    mcpServers: [],
    mcpRpcLogs: [],
    skillSelections: [],
    ...overrides,
  };
}

describe("threads/thread-save-signatures", () => {
  it("remembers and reads a saved signature for one thread", () => {
    const signatureMap = new Map<string, string>();
    const thread = createThreadState();

    rememberThreadSaveSignature(signatureMap, thread);

    expect(readSavedThreadSignature(signatureMap, "thread-1")).toBeTypeOf("string");
  });

  it("writes and clears explicit signatures", () => {
    const signatureMap = new Map<string, string>();

    writeThreadSaveSignature(signatureMap, "thread-1", "signature-1");
    expect(readSavedThreadSignature(signatureMap, "thread-1")).toBe("signature-1");

    clearThreadSaveSignatures(signatureMap);
    expect(readSavedThreadSignature(signatureMap, "thread-1")).toBeUndefined();
  });

  it("replaces signatures using the latest thread list", () => {
    const signatureMap = new Map<string, string>([
      ["stale-thread", "stale-signature"],
    ]);

    setThreadSaveSignatures(signatureMap, [
      createThreadState({
        id: "thread-1",
      }),
      createThreadState({
        id: "thread-2",
        name: "Thread 2",
      }),
    ]);

    expect([...signatureMap.keys()]).toEqual(["thread-1", "thread-2"]);
  });
});
