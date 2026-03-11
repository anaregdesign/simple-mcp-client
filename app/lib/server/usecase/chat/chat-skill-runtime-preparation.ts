type PrepareSkillRuntimeOptions<TRuntime, TExecutionContext> = {
  loadRuntime: () => Promise<TRuntime>;
  createExecutionContext: (runtime: TRuntime) => TExecutionContext | null;
  emitActivationLogs: (runtime: TRuntime, context: TExecutionContext) => void;
  collectWarnings: (runtime: TRuntime) => string[];
};

export type PrepareSkillRuntimeResult<TRuntime, TExecutionContext> = {
  runtime: TRuntime;
  executionContext: TExecutionContext | null;
  warnings: string[];
};

export async function prepareSkillRuntime<TRuntime, TExecutionContext>(
  options: PrepareSkillRuntimeOptions<TRuntime, TExecutionContext>,
): Promise<PrepareSkillRuntimeResult<TRuntime, TExecutionContext>> {
  const runtime = await options.loadRuntime();
  const executionContext = options.createExecutionContext(runtime);
  if (executionContext) {
    options.emitActivationLogs(runtime, executionContext);
  }

  return {
    runtime,
    executionContext,
    warnings: options.collectWarnings(runtime),
  };
}
