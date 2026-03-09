/**
 * Test module verifying thread operation phase helpers.
 */
import { describe, expect, it } from "vitest";
import {
  canTransition,
  canStartThreadOperation,
  completeThreadOperationPhase,
  isThreadOperationPhaseBusy,
  transitionThreadOperation,
} from "~/lib/client/usecase/workspace/thread-operation-phase";

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

describe("canTransition", () => {
  it("supports valid start, complete, and reset events", () => {
    expect(
      canTransition("idle", {
        type: "start",
        phase: "creating",
      }),
    ).toBe(true);
    expect(
      canTransition("creating", {
        type: "complete",
        phase: "creating",
      }),
    ).toBe(true);
    expect(
      canTransition("switching", {
        type: "reset",
      }),
    ).toBe(true);
  });

  it("rejects invalid transitions", () => {
    expect(
      canTransition("deleting", {
        type: "start",
        phase: "switching",
      }),
    ).toBe(false);
    expect(
      canTransition("clearing", {
        type: "complete",
        phase: "loading",
      }),
    ).toBe(false);
    expect(
      canTransition("idle", {
        type: "reset",
      }),
    ).toBe(false);
  });
});

describe("transitionThreadOperation", () => {
  it("applies valid transitions and reports metadata", () => {
    expect(
      transitionThreadOperation("idle", {
        type: "start",
        phase: "loading",
      }),
    ).toEqual({
      from: "idle",
      event: {
        type: "start",
        phase: "loading",
      },
      to: "loading",
      applied: true,
    });

    expect(
      transitionThreadOperation("loading", {
        type: "complete",
        phase: "loading",
      }).to,
    ).toBe("idle");
  });

  it("keeps state on invalid transitions (idempotent invalid events)", () => {
    const first = transitionThreadOperation("deleting", {
      type: "start",
      phase: "switching",
    });
    const second = transitionThreadOperation(first.to, {
      type: "start",
      phase: "switching",
    });

    expect(first).toEqual({
      from: "deleting",
      event: {
        type: "start",
        phase: "switching",
      },
      to: "deleting",
      applied: false,
    });
    expect(second.to).toBe("deleting");
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
