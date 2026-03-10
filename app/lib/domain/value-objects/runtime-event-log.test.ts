import { describe, expect, it } from "vitest";
import {
  normalizeRuntimeEventLogLevel,
  readRuntimeEventLogErrorDetails,
  serializeRuntimeEventLogContext,
} from "~/lib/domain/value-objects/runtime-event-log";

describe("runtime-event-log value object", () => {
  it("normalizes level values", () => {
    expect(normalizeRuntimeEventLogLevel("warning")).toBe("warning");
    expect(normalizeRuntimeEventLogLevel("nope")).toBe("error");
  });

  it("extracts error details from Error and unknown values", () => {
    const error = new Error("boom");
    error.name = "CustomError";

    expect(readRuntimeEventLogErrorDetails(error)).toEqual({
      name: "CustomError",
      message: "boom",
      stack: expect.any(String),
    });
    expect(readRuntimeEventLogErrorDetails({ reason: "failed" }).name).toBe(
      "UnknownError",
    );
  });

  it("serializes nested context with truncation", () => {
    const serialized = serializeRuntimeEventLogContext({
      a: {
        b: {
          c: {
            d: {
              e: {
                f: {
                  g: "too-deep",
                },
              },
            },
          },
        },
      },
    });

    expect(JSON.parse(serialized)).toHaveProperty("a");
  });
});
