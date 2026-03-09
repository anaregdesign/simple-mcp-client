import { describe, expect, it } from "vitest";
import {
  cloneThreadEnvironment,
  DEFAULT_THREAD_INSTRUCTION_CONTEXT_TOGGLES,
  hasThreadPersistableState,
  ThreadRecord,
  type ThreadRecordSnapshot,
} from "~/lib/domain/entities/thread-record";

function createThreadRecordSnapshot(): ThreadRecordSnapshot {
  return {
    id: "thread-a",
    userId: 1,
    name: "Thread A",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    deletedAt: null,
    reasoningEffort: "medium",
    webSearchEnabled: false,
    threadEnvironment: {},
    instructionContextToggles: { system: true },
    instruction: {
      id: 1,
      threadId: "thread-a",
      content: "",
    },
    messages: [
      {
        id: "message-a",
        threadId: "thread-a",
        conversationOrder: 0,
        role: "user",
        content: "hello",
        createdAt: "2026-01-01T00:00:00.000Z",
        turnId: "turn-a",
        attachments: [],
        skillActivations: [],
      },
    ],
    mcpServers: [],
    mcpRpcLogs: [],
    skillSelections: [],
  };
}

describe("ThreadRecord", () => {
  it("reports lifecycle rules from persisted state", () => {
    const record = new ThreadRecord(createThreadRecordSnapshot());

    expect(record.isArchived()).toBe(false);
    expect(record.canBeArchived()).toBe(true);
  });

  it("returns defensive snapshot copies", () => {
    const record = new ThreadRecord(createThreadRecordSnapshot());
    const snapshot = record.toSnapshot();

    snapshot.messages[0]!.content = "mutated";

    expect(record.toSnapshot().messages[0]!.content).toBe("hello");
  });

  it("treats archived records as archived", () => {
    const record = ThreadRecord.fromSnapshot({
      ...createThreadRecordSnapshot(),
      deletedAt: "2026-01-03T00:00:00.000Z",
      messages: [],
    });

    expect(record.isArchived()).toBe(true);
    expect(record.canBeArchived()).toBe(false);
  });
});

describe("thread-record helpers", () => {
  it("clones thread environment defensively", () => {
    const environment = {
      PATH: "/tmp/bin",
    };

    const cloned = cloneThreadEnvironment(environment);
    cloned.PATH = "/tmp/other";

    expect(environment.PATH).toBe("/tmp/bin");
  });

  it("treats default thread settings as non-persistable", () => {
    expect(
      hasThreadPersistableState({
        messages: [],
        reasoningEffort: "none",
        webSearchEnabled: false,
        instructionContextToggles: DEFAULT_THREAD_INSTRUCTION_CONTEXT_TOGGLES,
        threadEnvironment: {},
      }),
    ).toBe(false);
  });
});
