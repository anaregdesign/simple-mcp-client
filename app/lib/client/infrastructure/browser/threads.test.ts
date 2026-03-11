import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearThreadTimeout,
  deferAppliedThreadStateReset,
  scheduleThreadTimeout,
} from "~/lib/client/infrastructure/browser/threads";

describe("thread browser timers", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("schedules and clears a thread timeout", () => {
    vi.useFakeTimers();
    const onElapsed = vi.fn();
    const windowStub = {
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
    };
    const timeoutRef: { current: number | null } = {
      current: null,
    };
    vi.stubGlobal("window", windowStub);

    scheduleThreadTimeout({
      timeoutRef,
      delayMs: 300,
      onElapsed,
    });
    clearThreadTimeout(timeoutRef);
    vi.advanceTimersByTime(300);

    expect(onElapsed).not.toHaveBeenCalled();
    expect(timeoutRef.current).toBeNull();
  });

  it("resets the timeout ref after the callback runs", () => {
    vi.useFakeTimers();
    const onElapsed = vi.fn();
    const windowStub = {
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
    };
    const timeoutRef: { current: number | null } = {
      current: null,
    };
    vi.stubGlobal("window", windowStub);

    scheduleThreadTimeout({
      timeoutRef,
      delayMs: 450,
      onElapsed,
    });
    vi.advanceTimersByTime(450);

    expect(onElapsed).toHaveBeenCalledTimes(1);
    expect(timeoutRef.current).toBeNull();
  });

  it("defers the applying-thread-state reset", () => {
    vi.useFakeTimers();
    const onElapsed = vi.fn();
    const windowStub = {
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
    };
    vi.stubGlobal("window", windowStub);

    deferAppliedThreadStateReset(onElapsed);
    expect(onElapsed).not.toHaveBeenCalled();

    vi.advanceTimersByTime(0);
    expect(onElapsed).toHaveBeenCalledTimes(1);
  });
});
