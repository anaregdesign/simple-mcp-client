import { describe, expect, it } from "vitest";
import { hasPersistableThreadState } from "~/lib/domain/policies/thread-persistable-state";
import { cloneThreadEnvironment } from "~/lib/domain/value-objects/thread-environment";
import { DEFAULT_THREAD_INSTRUCTION_CONTEXT_TOGGLES } from "~/lib/domain/value-objects/thread-instruction-context";
import {
  Thread,
  type ThreadProps,
} from "~/lib/domain/entities/thread";

function createThreadProps(): ThreadProps {
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
    operationLogs: [],
    skillSelections: [],
  };
}

describe("Thread", () => {
  it("reports lifecycle rules from persisted state", () => {
    const thread = new Thread(createThreadProps());

    expect(thread.isArchived()).toBe(false);
  });

  it("returns defensive copies from getters", () => {
    const thread = new Thread(createThreadProps());
    const messages = thread.messages;

    messages[0]!.content = "mutated";

    expect(thread.messages[0]!.content).toBe("hello");
  });

  it("archives and restores threads through lifecycle behavior", () => {
    const archived = new Thread({
      ...createThreadProps(),
      deletedAt: "2026-01-03T00:00:00.000Z",
    }).restore();

    expect(archived.isArchived()).toBe(false);
    expect(
      new Thread(createThreadProps()).archive("2026-01-03T00:00:00.000Z").deletedAt,
    ).toBe("2026-01-03T00:00:00.000Z");
  });

  it("allows archiving an empty thread", () => {
    const thread = new Thread({
      ...createThreadProps(),
      messages: [],
      skillSelections: [],
    });

    expect(thread.archive("2026-01-03T00:00:00.000Z").deletedAt).toBe(
      "2026-01-03T00:00:00.000Z",
    );
  });
});

describe("thread helpers", () => {
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
      hasPersistableThreadState({
        messageCount: 0,
        skillSelectionCount: 0,
        reasoningEffort: "none",
        webSearchEnabled: false,
        instructionContent: "",
        instructionContextToggles: DEFAULT_THREAD_INSTRUCTION_CONTEXT_TOGGLES,
        threadEnvironment: {},
      }),
    ).toBe(false);
  });
});
