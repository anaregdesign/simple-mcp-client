/**
 * Test module verifying client thread state helper behavior.
 */
import { describe, expect, it } from "vitest";
import {
  isThreadArchivedById,
  isThreadArchived,
  readThreadRuntimeStateById,
  readThreadStateById,
  updateThreadStateCollectionById,
} from "~/lib/client/usecase/workspace/threads/thread-state";

describe("isThreadArchived", () => {
  it("returns false when the thread state is missing", () => {
    expect(isThreadArchived(null)).toBe(false);
    expect(isThreadArchived(undefined)).toBe(false);
  });

  it("returns false when deletedAt is null", () => {
    expect(isThreadArchived({ deletedAt: null })).toBe(false);
  });

  it("returns true when deletedAt is set", () => {
    expect(isThreadArchived({ deletedAt: "2026-02-20T00:00:00.000Z" })).toBe(
      true,
    );
  });
});

describe("isThreadArchivedById", () => {
  const snapshots = [
    { id: "thread-active", deletedAt: null },
    { id: "thread-archived", deletedAt: "2026-02-20T00:00:00.000Z" },
  ];

  it("returns false when the id is empty or unknown", () => {
    expect(isThreadArchivedById(snapshots, "")).toBe(false);
    expect(isThreadArchivedById(snapshots, "thread-missing")).toBe(false);
  });

  it("returns false for active thread ids", () => {
    expect(isThreadArchivedById(snapshots, "thread-active")).toBe(false);
  });

  it("returns true for archived thread ids", () => {
    expect(isThreadArchivedById(snapshots, "thread-archived")).toBe(true);
  });
});

describe("readThreadStateById", () => {
  const snapshots = [
    {
      id: "thread-a",
      name: "A",
      createdAt: "2026-03-08T00:00:00.000Z",
      updatedAt: "2026-03-08T00:00:00.000Z",
      deletedAt: null,
      reasoningEffort: "none" as const,
      webSearchEnabled: false,
      agentInstruction: "",
      instructionContextToggles: { system: true },
      threadEnvironment: {},
      messages: [],
      mcpServers: [],
      mcpRpcLogs: [],
      skillSelections: [],
    },
  ];

  it("returns null for empty ids", () => {
    expect(readThreadStateById(snapshots, "")).toBeNull();
  });

  it("returns the matching thread state by id", () => {
    expect(readThreadStateById(snapshots, "thread-a")?.id).toBe("thread-a");
  });
});

describe("readThreadRuntimeStateById", () => {
  const snapshots = [
    {
      id: "thread-runtime",
      name: "Runtime",
      createdAt: "2026-03-08T00:00:00.000Z",
      updatedAt: "2026-03-08T00:00:00.000Z",
      deletedAt: null,
      reasoningEffort: "none" as const,
      webSearchEnabled: false,
      agentInstruction: "",
      instructionContextToggles: { system: true },
      threadEnvironment: {},
      messages: [
        {
          id: "message-1",
          role: "user" as const,
          content: "hello",
          createdAt: "2026-03-08T00:00:00.000Z",
          turnId: "turn-1",
          attachments: [],
          skillActivations: [],
        },
      ],
      mcpServers: [],
      mcpRpcLogs: [],
      skillSelections: [],
    },
  ];

  it("returns empty runtime state when active thread is missing", () => {
    expect(readThreadRuntimeStateById(snapshots, "missing")).toEqual({
      activeThreadState: null,
      messages: [],
      mcpServers: [],
      mcpRpcLogs: [],
      skillSelections: [],
    });
  });

  it("returns cloned runtime state for matching thread", () => {
    const state = readThreadRuntimeStateById(snapshots, "thread-runtime");
    expect(state.activeThreadState?.id).toBe("thread-runtime");
    expect(state.messages).toHaveLength(1);
    expect(state.messages).not.toBe(snapshots[0]?.messages);
  });
});

describe("updateThreadStateCollectionById", () => {
  const baseSnapshots = [
    {
      id: "thread-1",
      name: "Before",
      createdAt: "2026-03-08T00:00:00.000Z",
      updatedAt: "2026-03-08T00:00:00.000Z",
      deletedAt: null,
      reasoningEffort: "none" as const,
      webSearchEnabled: false,
      agentInstruction: "",
      instructionContextToggles: { system: true },
      threadEnvironment: {},
      messages: [],
      mcpServers: [],
      mcpRpcLogs: [],
      skillSelections: [],
    },
  ];

  it("returns the original collection when thread id is missing", () => {
    const next = updateThreadStateCollectionById(
      baseSnapshots,
      "missing",
      (current) => current,
    );
    expect(next).toBe(baseSnapshots);
  });

  it("updates the target thread state and keeps array sorted by updatedAt", () => {
    const next = updateThreadStateCollectionById(
      baseSnapshots,
      "thread-1",
      (current) => ({
        ...current,
        name: "After",
        updatedAt: "2026-03-08T00:00:01.000Z",
      }),
    );
    expect(next).toHaveLength(1);
    expect(next[0]?.name).toBe("After");
  });
});
