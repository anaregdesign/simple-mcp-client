import { describe, expect, it } from "vitest";
import {
  ensureThreadPayloadMatchesPath,
  readThreadIdParam,
  readThreadRestoreRequest,
  readThreadWritePayload,
} from "./thread-route-parsing";

describe("thread-route-parsing", () => {
  it("reads a trimmed thread id from route params", () => {
    expect(readThreadIdParam("  thread-a  ")).toEqual({
      ok: true,
      value: "thread-a",
    });
  });

  it("returns a validation issue for an empty thread id", () => {
    const result = readThreadIdParam("   ");
    expect(result).toMatchObject({
      ok: false,
      issue: {
        code: "invalid_thread_id",
        eventName: "invalid_thread_id_payload",
      },
    });
  });

  it("parses a thread write payload with the default instruction fallback", () => {
    const result = readThreadWritePayload({
      id: "thread-a",
      name: "Thread A",
      createdAt: "2026-01-01T00:00:00.000Z",
      reasoningEffort: "medium",
      webSearchEnabled: false,
      instruction: {},
      instructionContextToggles: {
        system: true,
      },
      threadEnvironment: {},
      messages: [],
      mcpServers: [],
      mcpRpcLogs: [],
      skillSelections: [],
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        id: "thread-a",
        instruction: {
          content: expect.any(String),
        },
      },
    });
  });

  it("returns a validation issue for an invalid thread write payload", () => {
    const result = readThreadWritePayload({ id: 123 });
    expect(result).toMatchObject({
      ok: false,
      issue: {
        code: "invalid_thread_payload",
        action: "read_thread_snapshot",
      },
    });
  });

  it("returns mismatch metadata when payload thread id differs from path id", () => {
    expect(ensureThreadPayloadMatchesPath("thread-a", "thread-b")).toEqual({
      statusCode: 422,
      code: "thread_id_mismatch",
      error: "`thread.id` must match path `threadId`.",
      eventName: "thread_id_mismatch",
      action: "validate_payload",
      message: "`thread.id` must match path `threadId`.",
      context: {
        payloadThreadId: "thread-b",
      },
    });
  });

  it("reads a restore request when archived is false", () => {
    expect(readThreadRestoreRequest({ archived: false })).toEqual({
      ok: true,
      value: true,
    });
  });

  it("returns a validation issue for an invalid restore request", () => {
    const result = readThreadRestoreRequest({ archived: true });
    expect(result).toMatchObject({
      ok: false,
      issue: {
        code: "invalid_restore_payload",
        message: "`archived` must be false.",
      },
    });
  });
});
