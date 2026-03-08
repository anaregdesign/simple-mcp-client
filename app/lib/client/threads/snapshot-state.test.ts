/**
 * Test module verifying snapshot-state behavior.
 */
import { describe, expect, it } from "vitest";
import {
  hasThreadPersistableState,
  hasThreadInteraction,
  isThreadArchivedById,
  isThreadSnapshotArchived,
  readThreadRuntimeStateById,
  readThreadSnapshotById,
  updateThreadSnapshotCollectionById,
} from "~/lib/client/threads/snapshot-state";

describe("hasThreadInteraction", () => {
  it("returns false for threads without messages", () => {
    expect(hasThreadInteraction({ messages: [] })).toBe(false);
  });

  it("returns true for threads with selected skills", () => {
    expect(
      hasThreadInteraction({
        messages: [],
        skillSelections: [
          {
            name: "local-playground-dev",
            location: "/repo/skills/local-playground-dev/SKILL.md",
          },
        ],
      }),
    ).toBe(true);
  });

  it("returns true for threads with messages", () => {
    expect(
      hasThreadInteraction({
        messages: [
          {
            id: "message-1",
            role: "user",
            content: "Hello",
            createdAt: "2026-03-01T00:00:00.000Z",
            turnId: "turn-1",
            attachments: [],
            skillActivations: [],
          },
        ],
      }),
    ).toBe(true);
  });
});

describe("hasThreadPersistableState", () => {
  it("returns false when only default thread settings are present", () => {
    expect(
      hasThreadPersistableState({
        messages: [],
        reasoningEffort: "none",
        webSearchEnabled: false,
        instructionContextToggles: { system: true },
        threadEnvironment: {},
      }),
    ).toBe(false);
  });

  it("returns true when reasoning effort differs from default", () => {
    expect(
      hasThreadPersistableState({
        messages: [],
        reasoningEffort: "medium",
        webSearchEnabled: false,
        instructionContextToggles: { system: true },
        threadEnvironment: {},
      }),
    ).toBe(true);
  });

  it("returns true when web search is enabled", () => {
    expect(
      hasThreadPersistableState({
        messages: [],
        reasoningEffort: "none",
        webSearchEnabled: true,
        instructionContextToggles: { system: true },
        threadEnvironment: {},
      }),
    ).toBe(true);
  });

  it("returns true when thread environment variables are present", () => {
    expect(
      hasThreadPersistableState({
        messages: [],
        reasoningEffort: "none",
        webSearchEnabled: false,
        instructionContextToggles: { system: true },
        threadEnvironment: {
          VIRTUAL_ENV: "/tmp/.venv",
        },
      }),
    ).toBe(true);
  });

  it("returns true when instruction context toggles differ from defaults", () => {
    expect(
      hasThreadPersistableState({
        messages: [],
        reasoningEffort: "none",
        webSearchEnabled: false,
        instructionContextToggles: { system: false },
        threadEnvironment: {},
      }),
    ).toBe(true);
  });
});

describe("isThreadSnapshotArchived", () => {
  it("returns false when the snapshot is missing", () => {
    expect(isThreadSnapshotArchived(null)).toBe(false);
    expect(isThreadSnapshotArchived(undefined)).toBe(false);
  });

  it("returns false when deletedAt is null", () => {
    expect(isThreadSnapshotArchived({ deletedAt: null })).toBe(false);
  });

  it("returns true when deletedAt is set", () => {
    expect(isThreadSnapshotArchived({ deletedAt: "2026-02-20T00:00:00.000Z" })).toBe(true);
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

describe("readThreadSnapshotById", () => {
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
    expect(readThreadSnapshotById(snapshots, "")).toBeNull();
  });

  it("returns the matching snapshot by id", () => {
    expect(readThreadSnapshotById(snapshots, "thread-a")?.id).toBe("thread-a");
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
      activeThreadSnapshot: null,
      messages: [],
      mcpServers: [],
      mcpRpcLogs: [],
      skillSelections: [],
    });
  });

  it("returns cloned runtime state for matching thread", () => {
    const state = readThreadRuntimeStateById(snapshots, "thread-runtime");
    expect(state.activeThreadSnapshot?.id).toBe("thread-runtime");
    expect(state.messages).toHaveLength(1);
    expect(state.messages).not.toBe(snapshots[0]?.messages);
  });
});

describe("updateThreadSnapshotCollectionById", () => {
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
    const next = updateThreadSnapshotCollectionById(baseSnapshots, "missing", (current) => current);
    expect(next).toBe(baseSnapshots);
  });

  it("updates the target snapshot and keeps array sorted by updatedAt", () => {
    const next = updateThreadSnapshotCollectionById(baseSnapshots, "thread-1", (current) => ({
      ...current,
      name: "After",
      updatedAt: "2026-03-08T00:00:01.000Z",
    }));
    expect(next).toHaveLength(1);
    expect(next[0]?.name).toBe("After");
  });
});
