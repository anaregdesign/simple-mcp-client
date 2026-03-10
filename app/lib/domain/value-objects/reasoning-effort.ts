export const reasoningEffortValues = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
] as const;

export type ReasoningEffort = (typeof reasoningEffortValues)[number];

export const DEFAULT_REASONING_EFFORT: ReasoningEffort = "none";
