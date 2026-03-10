import { describe, expect, it } from "vitest";
import type { ThreadOperationLogEntry } from "~/lib/contracts/chat/operation-log";
import { upsertThreadOperationLogEntry } from "~/lib/server/usecase/chat/thread-operation-log-state";

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

describe("server thread-operation-log-state", () => {
  it("keeps history ordered when appending and replacing entries", () => {
    const next = upsertThreadOperationLogEntry(
      [],
      createEntry({
        id: "rpc-2",
        sequence: 2,
      }),
    );
    const sorted = upsertThreadOperationLogEntry(
      next,
      createEntry({
        id: "rpc-1",
        sequence: 1,
      }),
    );
    const replaced = upsertThreadOperationLogEntry(
      sorted,
      createEntry({
        id: "rpc-2",
        sequence: 2,
        method: "tools/call",
      }),
    );

    expect(replaced.map((entry) => entry.id)).toEqual(["rpc-1", "rpc-2"]);
    expect(replaced[1]?.method).toBe("tools/call");
  });
});
