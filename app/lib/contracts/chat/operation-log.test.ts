import { describe, expect, it } from "vitest";
import {
  buildThreadOperationLogCopyPayload,
  buildThreadOperationLogsByTurnId,
  collectSuccessfulSkillGuideLocations,
  parseSseDataBlock,
  readChatStreamEvent,
  readOperationLogType,
  readThreadOperationLogEntryFromUnknown,
  upsertThreadOperationLogEntry,
  type ThreadOperationLogEntry,
} from "./operation-log";

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

describe("parseSseDataBlock", () => {
  it("extracts data payload lines", () => {
    const block = [
      "event: message",
      'data: {"type":"progress","message":"step 1"}',
      "",
    ].join("\n");

    expect(parseSseDataBlock(block)).toBe(
      '{"type":"progress","message":"step 1"}',
    );
  });

  it("returns null when no data line exists", () => {
    expect(parseSseDataBlock("event: ping\nid: 1")).toBeNull();
  });
});

describe("readChatStreamEvent", () => {
  it("parses operation_log record payload", () => {
    const event = readChatStreamEvent(
      JSON.stringify({
        type: "operation_log",
        record: {
          id: "rpc-1",
          sequence: 1,
          operationType: "mcp",
          serverName: "workiq",
          method: "tools/call",
          startedAt: "2026-02-16T00:00:00.000Z",
          completedAt: "2026-02-16T00:00:01.000Z",
          request: {
            jsonrpc: "2.0",
            id: "rpc-1",
            method: "tools/call",
            params: {},
          },
          response: { jsonrpc: "2.0", id: "rpc-1", result: {} },
          isError: false,
        },
      }),
    );

    expect(event).not.toBeNull();
    expect(event?.type).toBe("operation_log");
  });

  it("parses final payload with thread environment", () => {
    const event = readChatStreamEvent(
      JSON.stringify({
        type: "final",
        message: "done",
        threadEnvironment: {
          VIRTUAL_ENV: "/tmp/.venv",
        },
      }),
    );

    expect(event).toEqual({
      type: "final",
      message: "done",
      threadEnvironment: {
        VIRTUAL_ENV: "/tmp/.venv",
      },
    });
  });
});

describe("readThreadOperationLogEntryFromUnknown", () => {
  it("accepts valid MCP JSON-RPC history entries", () => {
    const entry = readThreadOperationLogEntryFromUnknown({
      id: "rpc-2",
      sequence: 2,
      operationType: "mcp",
      serverName: "workiq",
      method: "tools/list",
      startedAt: "2026-02-16T00:00:00.000Z",
      completedAt: "2026-02-16T00:00:01.000Z",
      request: { jsonrpc: "2.0", id: "rpc-2", method: "tools/list", params: {} },
      response: { jsonrpc: "2.0", id: "rpc-2", result: {} },
      isError: false,
    });

    expect(entry).not.toBeNull();
    expect(entry?.sequence).toBe(2);
    expect(entry?.serverName).toBe("workiq");
    expect(entry?.turnId).toBe("");
  });

  it("rejects invalid entries", () => {
    expect(readThreadOperationLogEntryFromUnknown({ id: "", sequence: 1 })).toBeNull();
  });
});

describe("upsertThreadOperationLogEntry", () => {
  it("keeps history sorted by sequence and replaces duplicate ids", () => {
    const first = {
      id: "rpc-1",
      sequence: 2,
      operationType: "mcp" as const,
      serverName: "srv",
      method: "tools/call",
      startedAt: "2026-02-16T00:00:00.000Z",
      completedAt: "2026-02-16T00:00:01.000Z",
      request: {},
      response: {},
      isError: false,
      turnId: "turn-1",
    };
    const second = {
      id: "rpc-0",
      sequence: 1,
      operationType: "mcp" as const,
      serverName: "srv",
      method: "tools/list",
      startedAt: "2026-02-16T00:00:00.000Z",
      completedAt: "2026-02-16T00:00:01.000Z",
      request: {},
      response: {},
      isError: false,
      turnId: "turn-1",
    };

    const next = upsertThreadOperationLogEntry([], first);
    const sorted = upsertThreadOperationLogEntry(next, second);
    expect(sorted.map((entry) => entry.id)).toEqual(["rpc-0", "rpc-1"]);

    const replaced = upsertThreadOperationLogEntry(sorted, {
      ...first,
      method: "tools/call-updated",
    });
    expect(replaced.find((entry) => entry.id === "rpc-1")?.method).toBe(
      "tools/call-updated",
    );
  });

  it("repositions existing entries when ordering fields change", () => {
    const first = {
      id: "rpc-1",
      sequence: 1,
      operationType: "mcp" as const,
      serverName: "srv",
      method: "tools/call",
      startedAt: "2026-02-16T00:00:00.000Z",
      completedAt: "2026-02-16T00:00:01.000Z",
      request: {},
      response: {},
      isError: false,
      turnId: "turn-1",
    };
    const second = {
      id: "rpc-2",
      sequence: 1,
      operationType: "mcp" as const,
      serverName: "srv",
      method: "tools/list",
      startedAt: "2026-02-16T00:00:02.000Z",
      completedAt: "2026-02-16T00:00:03.000Z",
      request: {},
      response: {},
      isError: false,
      turnId: "turn-1",
    };

    const initial = upsertThreadOperationLogEntry(
      upsertThreadOperationLogEntry([], first),
      second,
    );
    expect(initial.map((entry) => entry.id)).toEqual(["rpc-1", "rpc-2"]);

    const moved = upsertThreadOperationLogEntry(initial, {
      ...second,
      startedAt: "2026-02-15T23:59:59.000Z",
    });
    expect(moved.map((entry) => entry.id)).toEqual(["rpc-2", "rpc-1"]);
  });
});

describe("buildThreadOperationLogsByTurnId", () => {
  it("groups entries by turnId and skips empty turn ids", () => {
    const grouped = buildThreadOperationLogsByTurnId([
      createEntry({ id: "a", turnId: "turn-1" }),
      createEntry({ id: "b", turnId: "" }),
      createEntry({ id: "c", turnId: "turn-2" }),
      createEntry({ id: "d", turnId: "turn-1" }),
    ]);

    expect(grouped.size).toBe(2);
    expect(grouped.get("turn-1")?.map((entry) => entry.id)).toEqual([
      "a",
      "d",
    ]);
    expect(grouped.get("turn-2")?.map((entry) => entry.id)).toEqual(["c"]);
  });
});

describe("buildThreadOperationLogCopyPayload", () => {
  it("normalizes request/response to null when undefined", () => {
    const payload = buildThreadOperationLogCopyPayload(
      createEntry({
        request: undefined,
        response: undefined,
      }),
    );

    expect(payload).toEqual({
      id: "rpc-1",
      sequence: 1,
      operationType: "mcp",
      serverName: "server-a",
      method: "tools/list",
      startedAt: "2026-02-19T00:00:00.000Z",
      completedAt: "2026-02-19T00:00:01.000Z",
      request: null,
      response: null,
      isError: false,
      turnId: "turn-1",
    });
  });
});

describe("readOperationLogType", () => {
  it("classifies skill-prefixed methods as skill operations", () => {
    expect(
      readOperationLogType({ operationType: "skill", method: "tools/call" }),
    ).toBe("skill");
    expect(readOperationLogType({ method: "skill_run_script" })).toBe("skill");
    expect(readOperationLogType({ method: "tools/call" })).toBe("mcp");
  });
});

describe("collectSuccessfulSkillGuideLocations", () => {
  it("returns successfully loaded guide locations for currently selected skills", () => {
    const entries = [
      createEntry({
        id: "guide-1",
        operationType: "skill",
        method: "skill_read_guide",
        response: {
          jsonrpc: "2.0",
          id: "guide-1",
          result: {
            ok: true,
            location: "/skills/alpha/SKILL.md",
          },
        },
      }),
      createEntry({
        id: "guide-2",
        operationType: "skill",
        method: "skill_read_guide",
        response: {
          jsonrpc: "2.0",
          id: "guide-2",
          result: {
            ok: true,
            location: "/skills/beta/SKILL.md",
          },
        },
      }),
    ];

    expect(
      collectSuccessfulSkillGuideLocations(entries, [
        { location: "/skills/beta/SKILL.md" },
        { location: "/skills/alpha/SKILL.md" },
      ]),
    ).toEqual(["/skills/beta/SKILL.md", "/skills/alpha/SKILL.md"]);
  });

  it("ignores failed, malformed, and non-selected guide reads", () => {
    const entries = [
      createEntry({
        id: "guide-failed",
        operationType: "skill",
        method: "skill_read_guide",
        isError: true,
      }),
      createEntry({
        id: "guide-malformed",
        operationType: "skill",
        method: "skill_read_guide",
        response: {
          jsonrpc: "2.0",
          id: "guide-malformed",
          result: {
            ok: true,
          },
        },
      }),
      createEntry({
        id: "guide-other-skill",
        operationType: "skill",
        method: "skill_read_guide",
        response: {
          jsonrpc: "2.0",
          id: "guide-other-skill",
          result: {
            ok: true,
            location: "/skills/other/SKILL.md",
          },
        },
      }),
      createEntry({
        id: "list-resources",
        operationType: "skill",
        method: "skill_list_resources",
        response: {
          jsonrpc: "2.0",
          id: "list-resources",
          result: {
            ok: true,
            location: "/skills/alpha/SKILL.md",
          },
        },
      }),
      createEntry({
        id: "guide-success",
        operationType: "skill",
        method: "skill_read_guide",
        response: {
          jsonrpc: "2.0",
          id: "guide-success",
          result: {
            ok: true,
            location: "/skills/alpha/SKILL.md",
          },
        },
      }),
    ];

    expect(
      collectSuccessfulSkillGuideLocations(entries, [
        { location: "/skills/alpha/SKILL.md" },
        { location: "/skills/beta/SKILL.md" },
      ]),
    ).toEqual(["/skills/alpha/SKILL.md"]);
  });
});
