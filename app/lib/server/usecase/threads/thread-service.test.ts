import { describe, expect, it } from "vitest";
import {
  readErrorMessage,
} from "./thread-service";

describe("thread-service", () => {
  it("normalizes unknown errors", () => {
    expect(readErrorMessage(new Error("boom"))).toBe("boom");
    expect(readErrorMessage({})).toBe("Unknown error.");
  });
});
