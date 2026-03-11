import { describe, expect, it } from "vitest";
import { buildThreadOperationLogCopyPayload } from "~/components/playground/rendering/operation-log-copy";

describe("operation-log-copy", () => {
  it("builds a copy payload with the normalized operation type", () => {
    expect(
      buildThreadOperationLogCopyPayload({
        id: "rpc-1",
        sequence: 1,
        operationType: "skill",
        serverName: "skill-runtime",
        method: "skill_read_guide",
        startedAt: "2026-02-16T00:00:00.000Z",
        completedAt: "2026-02-16T00:00:01.000Z",
        request: {
          jsonrpc: "2.0",
        },
        response: null,
        isError: false,
        turnId: "turn-1",
      }),
    ).toEqual({
      operationType: "skill",
      id: "rpc-1",
      sequence: 1,
      serverName: "skill-runtime",
      method: "skill_read_guide",
      startedAt: "2026-02-16T00:00:00.000Z",
      completedAt: "2026-02-16T00:00:01.000Z",
      request: {
        jsonrpc: "2.0",
      },
      response: null,
      isError: false,
      turnId: "turn-1",
    });
  });
});
