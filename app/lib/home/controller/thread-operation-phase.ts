/**
 * Home runtime support module.
 */
export type ThreadOperationPhase =
  | "idle"
  | "loading"
  | "switching"
  | "creating"
  | "deleting"
  | "clearing"
  | "restoring";

export type ThreadOperationEvent =
  | {
      type: "start";
      phase: Exclude<ThreadOperationPhase, "idle">;
    }
  | {
      type: "complete";
      phase: Exclude<ThreadOperationPhase, "idle">;
    }
  | {
      type: "reset";
    };

export type ThreadOperationTransition = {
  from: ThreadOperationPhase;
  event: ThreadOperationEvent;
  to: ThreadOperationPhase;
  applied: boolean;
};

export function isThreadOperationPhaseBusy(phase: ThreadOperationPhase): boolean {
  return phase !== "idle";
}

export function canStartThreadOperation(phase: ThreadOperationPhase): boolean {
  return canTransition(phase, {
    type: "start",
    phase: "loading",
  });
}

export function completeThreadOperationPhase(
  current: ThreadOperationPhase,
  expected: Exclude<ThreadOperationPhase, "idle">,
): ThreadOperationPhase {
  return transitionThreadOperation(current, {
    type: "complete",
    phase: expected,
  }).to;
}

export function canTransition(
  current: ThreadOperationPhase,
  event: ThreadOperationEvent,
): boolean {
  if (event.type === "reset") {
    return current !== "idle";
  }

  if (event.type === "start") {
    return current === "idle";
  }

  return current === event.phase;
}

export function transitionThreadOperation(
  current: ThreadOperationPhase,
  event: ThreadOperationEvent,
): ThreadOperationTransition {
  if (!canTransition(current, event)) {
    return {
      from: current,
      event,
      to: current,
      applied: false,
    };
  }

  if (event.type === "start") {
    return {
      from: current,
      event,
      to: event.phase,
      applied: true,
    };
  }

  return {
    from: current,
    event,
    to: "idle",
    applied: true,
  };
}
