import { describe, expect, it } from "vitest";
import {
  buildThreadStateFromCurrentState,
  createLocalThreadState,
} from "~/lib/client/usecase/workspace/threads/local-thread-state";
import {
  buildThreadPersistencePlan,
  buildThreadPersistencePlanFromCurrentState,
  canPersistThreadState,
} from "~/lib/client/usecase/workspace/threads/thread-persistence-plan";
import { buildThreadSaveSignature } from "~/lib/client/usecase/workspace/threads/thread-save-state";
import type { ThreadState } from "~/lib/client/usecase/workspace/threads/thread-state";

function createThreadState(overrides: Partial<ThreadState> = {}): ThreadState {
  return {
    ...createLocalThreadState({
      name: "Thread 1",
      defaultThreadMcpServers: [],
      createThreadId: () => "thread-1",
      now: () => "2026-03-10T00:00:00.000Z",
    }),
    ...overrides,
  };
}

describe("threads/thread-persistence-plan", () => {
  it("does not create a save plan for an untouched unsaved thread", () => {
    const thread = createThreadState();

    expect(
      canPersistThreadState(thread, () => undefined),
    ).toBe(false);
    expect(
      buildThreadPersistencePlan(thread, {
        readSavedThreadSignature: () => undefined,
      }),
    ).toBeNull();
  });

  it("allows a previously saved thread to persist even when it has no current deltas", () => {
    const thread = createThreadState();

    expect(
      canPersistThreadState(thread, () => "saved-signature"),
    ).toBe(true);

    const plan = buildThreadPersistencePlan(thread, {
      readSavedThreadSignature: () => "saved-signature",
    });
    expect(plan).not.toBeNull();
    expect(plan?.hasSavedSignature).toBe(true);
  });

  it("treats instruction-only changes as persistable", () => {
    const thread = createThreadState({
      agentInstruction: "Summarize tradeoffs before recommending.",
    });

    expect(
      canPersistThreadState(thread, () => undefined),
    ).toBe(true);

    const plan = buildThreadPersistencePlan(thread, {
      readSavedThreadSignature: () => undefined,
    });
    expect(plan?.signature).toBe(buildThreadSaveSignature(thread));
  });

  it("builds a mapped snapshot from current state for background name saves", () => {
    const baseThread = createThreadState({
      agentInstruction: "Summarize tradeoffs before recommending.",
    });

    const plan = buildThreadPersistencePlanFromCurrentState({
      baseThread,
      buildThreadStateFromCurrentState: (base, options) =>
        buildThreadStateFromCurrentState(base, {
          includeDraftName: options?.includeDraftName,
          activeThreadNameInput: "",
          reasoningEffort: base.reasoningEffort,
          webSearchEnabled: base.webSearchEnabled,
          chatAzureConfig: base.chatAzureConfig,
          agentInstruction: base.agentInstruction,
          instructionContextToggles: base.instructionContextToggles,
          messages: base.messages,
          mcpServers: base.mcpServers,
          mcpRpcLogs: base.mcpRpcLogs,
          selectedThreadSkills: base.skillSelections,
          now: () => "2026-03-10T01:00:00.000Z",
        }),
      readSavedThreadSignature: () => undefined,
      includeDraftName: true,
      mapSnapshot: (snapshot) => ({
        ...snapshot,
        name: "Renamed Thread",
      }),
    });

    expect(plan).not.toBeNull();
    expect(plan?.snapshot.name).toBe("Renamed Thread");
    expect(plan?.snapshot.updatedAt).toBe("2026-03-10T01:00:00.000Z");
  });

  it("skips plans whose signature is already saved", () => {
    const baseThread = createThreadState({
      agentInstruction: "Summarize tradeoffs before recommending.",
    });
    const snapshot = buildThreadStateFromCurrentState(baseThread, {
      activeThreadNameInput: "",
      reasoningEffort: baseThread.reasoningEffort,
      webSearchEnabled: baseThread.webSearchEnabled,
      chatAzureConfig: baseThread.chatAzureConfig,
      agentInstruction: baseThread.agentInstruction,
      instructionContextToggles: baseThread.instructionContextToggles,
      messages: baseThread.messages,
      mcpServers: baseThread.mcpServers,
      mcpRpcLogs: baseThread.mcpRpcLogs,
      selectedThreadSkills: baseThread.skillSelections,
      now: () => "2026-03-10T01:00:00.000Z",
    });
    const savedSignature = buildThreadSaveSignature(snapshot);

    const plan = buildThreadPersistencePlan(snapshot, {
      readSavedThreadSignature: () => savedSignature,
    });

    expect(plan).toBeNull();
  });
});
