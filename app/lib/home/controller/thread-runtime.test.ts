/**
 * Tests for Home controller thread runtime helpers.
 */
import { describe, expect, it } from "vitest";
import type { ThreadSnapshot } from "~/lib/home/thread/types";
import {
  buildThreadListOptions,
  findThreadSnapshotById,
  mergeSkillSelections,
} from "~/lib/home/controller/thread-runtime";

describe("buildThreadListOptions", () => {
  const summaries = [
    {
      id: "thread-1",
      name: "First",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      deletedAt: null,
      messageCount: 1,
      mcpServerCount: 0,
    },
    {
      id: "thread-2",
      name: "Second",
      createdAt: "2026-01-02T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      deletedAt: null,
      messageCount: 2,
      mcpServerCount: 1,
    },
  ];

  it("overrides the active thread display name and reflects awaiting state", () => {
    const options = buildThreadListOptions({
      summaries,
      threadRequestStateById: {
        "thread-2": {
          isSending: true,
          sendProgressMessages: [],
          activeTurnId: null,
          lastErrorTurnId: null,
          error: null,
        },
      },
      renameActiveThreadId: "thread-1",
      activeThreadNameInput: "Renamed Thread",
    });

    expect(options).toEqual([
      {
        id: "thread-1",
        name: "Renamed Thread",
        updatedAt: "2026-01-01T00:00:00.000Z",
        deletedAt: null,
        messageCount: 1,
        mcpServerCount: 0,
        isAwaitingResponse: false,
      },
      {
        id: "thread-2",
        name: "Second",
        updatedAt: "2026-01-02T00:00:00.000Z",
        deletedAt: null,
        messageCount: 2,
        mcpServerCount: 1,
        isAwaitingResponse: true,
      },
    ]);
  });

  it("keeps stored thread names when active input is blank", () => {
    const options = buildThreadListOptions({
      summaries,
      threadRequestStateById: {},
      renameActiveThreadId: "thread-1",
      activeThreadNameInput: "   ",
    });

    expect(options[0]?.name).toBe("First");
  });
});

describe("mergeSkillSelections", () => {
  it("merges thread and message skill selections without duplicate locations", () => {
    const merged = mergeSkillSelections(
      [
        { name: "Skill A", location: " /skills/a " },
        { name: "Skill B", location: "/skills/b" },
      ],
      [
        { name: "Duplicate Skill A", location: "/skills/a" },
        { name: "Skill C", location: "/skills/c" },
        { name: "Ignored Blank", location: "   " },
      ],
    );

    expect(merged).toEqual([
      { name: "Skill A", location: "/skills/a" },
      { name: "Skill B", location: "/skills/b" },
      { name: "Skill C", location: "/skills/c" },
    ]);
  });
});

describe("findThreadSnapshotById", () => {
  const threads: ThreadSnapshot[] = [
    {
      id: "thread-1",
      name: "Thread 1",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      deletedAt: null,
      reasoningEffort: "low",
      webSearchEnabled: false,
      agentInstruction: "",
      instructionContextToggles: {
        system: true,
      },
      threadEnvironment: {},
      messages: [],
      mcpServers: [],
      mcpRpcLogs: [],
      skillSelections: [],
    },
  ];

  it("returns null for empty identifiers", () => {
    expect(findThreadSnapshotById(threads, "   ")).toBeNull();
  });

  it("trims identifiers before matching", () => {
    expect(findThreadSnapshotById(threads, " thread-1 ")).toEqual(threads[0]);
  });

  it("returns null when no thread matches", () => {
    expect(findThreadSnapshotById(threads, "thread-2")).toBeNull();
  });
});
