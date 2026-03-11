import type { MutableRefObject } from "react";

type ThreadTimeoutRef = MutableRefObject<number | null>;

type ScheduleThreadTimeoutOptions = {
  delayMs: number;
  onElapsed: () => void;
  timeoutRef: ThreadTimeoutRef;
};

export function clearThreadTimeout(timeoutRef: ThreadTimeoutRef): void {
  const timeoutId = timeoutRef.current;
  if (timeoutId === null) {
    return;
  }

  timeoutRef.current = null;
  if (typeof window === "undefined") {
    return;
  }

  window.clearTimeout(timeoutId);
}

export function scheduleThreadTimeout(
  options: ScheduleThreadTimeoutOptions,
): void {
  clearThreadTimeout(options.timeoutRef);

  if (typeof window === "undefined") {
    options.onElapsed();
    return;
  }

  options.timeoutRef.current = window.setTimeout(() => {
    options.timeoutRef.current = null;
    options.onElapsed();
  }, options.delayMs);
}

export function deferAppliedThreadStateReset(onElapsed: () => void): void {
  if (typeof window === "undefined") {
    queueMicrotask(onElapsed);
    return;
  }

  window.setTimeout(onElapsed, 0);
}
