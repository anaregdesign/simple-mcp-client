/**
 * Test module verifying thread operation phase helpers.
 */
import { describe, expect, it } from "vitest";
import {
  canStartThreadOperation,
  completeThreadOperationPhase,
  isThreadOperationPhaseBusy,
} from "~/lib/home/controller/thread-operation-phase";

describe("isThreadOperationPhaseBusy", () => {
  it("returns false only for idle phase", () => {
    expect(isThreadOperationPhaseBusy("idle")).toBe(false);
    expect(isThreadOperationPhaseBusy("loading")).toBe(true);
    expect(isThreadOperationPhaseBusy("switching")).toBe(true);
  });
});

describe("canStartThreadOperation", () => {
  it("allows operation start only when idle", () => {
    expect(canStartThreadOperation("idle")).toBe(true);
    expect(canStartThreadOperation("creating")).toBe(false);
  });
});

describe("completeThreadOperationPhase", () => {
  it("returns idle when current phase matches expected phase", () => {
    expect(completeThreadOperationPhase("loading", "loading")).toBe("idle");
  });

  it("keeps current phase when expected does not match", () => {
    expect(completeThreadOperationPhase("switching", "loading")).toBe("switching");
  });
});
