import { describe, expect, it } from "vitest";
import type { ThreadOperationLogEntry } from "~/lib/contracts/chat/operation-log";
import { upsertThreadOperationLogEntry } from "~/lib/client/usecase/workspace/threads/thread-operation-log-state";

function createEntry(
  overrides: Partial<ThreadOperationLogEntry>,
): ThreadOperationLogEntry {
  return {
    id: "rpc-1",
    sequence: 1,
    operationType: "mcp",
    serverName: "server-a",
    method: "tools/list",
    startedAt: "2026-02-19T00:00:00.000Z",
    completedAt: "2026-02-19T00:00:01.000Z",
    request: {},
    response: {},
    isError: false,
    turnId: "turn-1",
    ...overrides,
  };
}

describe("thread-operation-log-state", () => {
  it("keeps history sorted by sequence and replaces duplicate ids", () => {
    const next = upsertThreadOperationLogEntry(
      [],
      createEntry({
        id: "rpc-1",
        sequence: 2,
        method: "tools/call",
      }),
    );
    const sorted = upsertThreadOperationLogEntry(
      next,
      createEntry({
        id: "rpc-0",
        sequence: 1,
      }),
    );

    expect(sorted.map((entry) => entry.id)).toEqual(["rpc-0", "rpc-1"]);

    const replaced = upsertThreadOperationLogEntry(
      sorted,
      createEntry({
        id: "rpc-1",
        sequence: 2,
        method: "tools/call-updated",
      }),
    );
    expect(replaced.find((entry) => entry.id === "rpc-1")?.method).toBe(
      "tools/call-updated",
    );
  });

  it("repositions existing entries when ordering fields change", () => {
    const initial = upsertThreadOperationLogEntry(
      upsertThreadOperationLogEntry(
        [],
        createEntry({
          id: "rpc-1",
          sequence: 1,
          method: "tools/call",
          startedAt: "2026-02-16T00:00:00.000Z",
        }),
      ),
      createEntry({
        id: "rpc-2",
        sequence: 1,
        method: "tools/list",
        startedAt: "2026-02-16T00:00:02.000Z",
      }),
    );

    const moved = upsertThreadOperationLogEntry(
      initial,
      createEntry({
        id: "rpc-2",
        sequence: 1,
        method: "tools/list",
        startedAt: "2026-02-15T23:59:59.000Z",
      }),
    );

    expect(moved.map((entry) => entry.id)).toEqual(["rpc-2", "rpc-1"]);
  });
});
