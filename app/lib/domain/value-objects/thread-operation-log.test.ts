import { describe, expect, it } from "vitest";
import {
  cloneThreadOperationLog,
  cloneThreadOperationLogs,
} from "~/lib/domain/value-objects/thread-operation-log";

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
});
