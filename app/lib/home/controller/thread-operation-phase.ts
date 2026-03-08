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

export function isThreadOperationPhaseBusy(phase: ThreadOperationPhase): boolean {
  return phase !== "idle";
}

export function canStartThreadOperation(phase: ThreadOperationPhase): boolean {
  return phase === "idle";
}

export function completeThreadOperationPhase(
  current: ThreadOperationPhase,
  expected: Exclude<ThreadOperationPhase, "idle">,
): ThreadOperationPhase {
  return current === expected ? "idle" : current;
}
