/**
 * Test module verifying runtime-event-log behavior.
 */
import { describe, expect, it } from "vitest";
import {
  readClientRuntimeEventLogPayload,
} from "~/lib/contracts/shared/runtime-event-log";

describe("readClientRuntimeEventLogPayload", () => {
  it("parses a valid payload and normalizes optional fields", () => {
    const result = readClientRuntimeEventLogPayload({
      level: "warning",
      category: "frontend",
      eventName: "test_event",
      message: "Something happened",
      statusCode: 400,
      threadId: "thread-1",
      context: {
        step: "save",
      },
    });

    expect(result).toEqual({
      level: "warning",
      category: "frontend",
      eventName: "test_event",
      message: "Something happened",
      statusCode: 400,
      threadId: "thread-1",
      context: {
        step: "save",
      },
    });
  });

  it("returns null when required fields are missing", () => {
    expect(
      readClientRuntimeEventLogPayload({
        level: "error",
        category: "frontend",
        message: "missing event name",
      }),
    ).toBeNull();
  });
});
