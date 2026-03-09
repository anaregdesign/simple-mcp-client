export function buildAgentRunContext<TInput>(options: {
  historyInput: TInput[];
  currentInput: TInput;
  compactionSession: unknown | null;
}): { runInput: TInput[] } {
  return {
    runInput: options.compactionSession
      ? [options.currentInput]
      : [...options.historyInput, options.currentInput],
  };
}
