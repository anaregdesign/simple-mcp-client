import { describe, expect, it } from "vitest";
import {
  cloneThreadOperationLog,
  cloneThreadOperationLogs,
  upsertThreadOperationLogEntry,
} from "~/lib/domain/value-objects/thread-operation-log";
import type { ThreadOperationLogEntry } from "~/lib/contracts/chat/operation-log";

describe("thread-operation-log", () => {
  it("clones nested request and response payloads", () => {
    const entry = {
      rowId: "row-a",
      sourceRpcId: "rpc-a",
      threadId: "thread-a",
      conversationOrder: 0,
      sequence: 1,
      operationType: "mcp" as const,
      serverName: "Server A",
      method: "tools/list",
      startedAt: "2026-01-01T00:00:00.000Z",
      completedAt: "2026-01-01T00:00:01.000Z",
      request: {
        id: "rpc-a",
        params: ["tool-a"],
      },
      response: {
        ok: true,
      },
      isError: false,
      turnId: "turn-a",
    };

    const cloned = cloneThreadOperationLog(entry);
    (cloned.request as { params: string[] }).params[0] = "tool-b";
    (cloned.response as { ok: boolean }).ok = false;

    expect((entry.request as { params: string[] }).params[0]).toBe("tool-a");
    expect((entry.response as { ok: boolean }).ok).toBe(true);
  });

  it("clones log collections defensively", () => {
    const entry = {
      rowId: "row-a",
      sourceRpcId: "rpc-a",
      threadId: "thread-a",
      conversationOrder: 0,
      sequence: 1,
      operationType: "mcp" as const,
      serverName: "Server A",
      method: "tools/list",
      startedAt: "2026-01-01T00:00:00.000Z",
      completedAt: "2026-01-01T00:00:01.000Z",
      request: null,
      response: null,
      isError: false,
      turnId: "turn-a",
    };

    expect(cloneThreadOperationLogs([entry])[0]).not.toBe(entry);
  });

  it("keeps ordered transport log entries sorted and replaces duplicate ids", () => {
    const createTransportEntry = (
      overrides: Partial<ThreadOperationLogEntry>,
    ): ThreadOperationLogEntry => ({
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
    });

    const next = upsertThreadOperationLogEntry(
      [],
      createTransportEntry({
        id: "rpc-1",
        sequence: 2,
        method: "tools/call",
      }),
    );
    const sorted = upsertThreadOperationLogEntry(
      next,
      createTransportEntry({
        id: "rpc-0",
        sequence: 1,
      }),
    );

    expect(sorted.map((transportEntry) => transportEntry.id)).toEqual([
      "rpc-0",
      "rpc-1",
    ]);

    const moved = upsertThreadOperationLogEntry(
      sorted,
      createTransportEntry({
        id: "rpc-1",
        sequence: 2,
        method: "tools/call-updated",
        startedAt: "2026-02-18T23:59:59.000Z",
      }),
    );

    expect(moved.map((transportEntry) => transportEntry.id)).toEqual([
      "rpc-1",
      "rpc-0",
    ]);
    expect(moved[0]?.method).toBe("tools/call-updated");
  });
});
