import { describe, expect, it } from "vitest";
import {
  isThreadRestorePayload,
  readErrorMessage,
} from "./thread-service";

describe("thread-service", () => {
  it("accepts restore payload when archived is false", () => {
    expect(isThreadRestorePayload({ archived: false })).toBe(true);
  });

  it("rejects restore payload when archived is not false", () => {
    expect(isThreadRestorePayload({ archived: true })).toBe(false);
    expect(isThreadRestorePayload({})).toBe(false);
    expect(isThreadRestorePayload(null)).toBe(false);
  });

  it("normalizes unknown errors", () => {
    expect(readErrorMessage(new Error("boom"))).toBe("boom");
    expect(readErrorMessage({})).toBe("Unknown error.");
  });
});
