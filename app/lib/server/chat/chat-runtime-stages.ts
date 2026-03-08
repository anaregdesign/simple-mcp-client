/**
 * Server chat runtime stage helpers.
 */
export type RuntimeMcpLease = {
  status: "connected" | "reused";
  isEphemeral: boolean;
  release: () => Promise<void>;
};

export type ChatRuntimeMcpMetrics = {
  mcpConnectedCount: number;
  mcpReusedCount: number;
  mcpEphemeralConnectCount: number;
  mcpConnectDurationMs: number;
  mcpSetupDurationMs: number;
};

type PrepareMcpRuntimeOptions<TServerConfig, TServer, TLease extends RuntimeMcpLease> = {
  serverConfigs: TServerConfig[];
  connectServer: (
    serverConfig: TServerConfig,
  ) => Promise<{ lease: TLease; server: TServer; connectDurationMs: number }>;
  releaseLease: (lease: TLease) => Promise<void>;
};

export type PrepareMcpRuntimeResult<TServer, TLease extends RuntimeMcpLease> = {
  servers: TServer[];
  leases: TLease[];
  metrics: ChatRuntimeMcpMetrics;
};

export async function prepareMcpRuntime<TServerConfig, TServer, TLease extends RuntimeMcpLease>(
  options: PrepareMcpRuntimeOptions<TServerConfig, TServer, TLease>,
): Promise<PrepareMcpRuntimeResult<TServer, TLease>> {
  const metrics: ChatRuntimeMcpMetrics = {
    mcpConnectedCount: 0,
    mcpReusedCount: 0,
    mcpEphemeralConnectCount: 0,
    mcpConnectDurationMs: 0,
    mcpSetupDurationMs: 0,
  };

  if (options.serverConfigs.length === 0) {
    return {
      servers: [],
      leases: [],
      metrics,
    };
  }

  const setupStartedAtMs = Date.now();
  const connectResults = await Promise.allSettled(
    options.serverConfigs.map((serverConfig) => options.connectServer(serverConfig)),
  );

  const successfulResults: Array<{ lease: TLease; server: TServer; connectDurationMs: number }> = [];
  let firstError: Error | null = null;

  for (const result of connectResults) {
    if (result.status === "fulfilled") {
      successfulResults.push(result.value);
      metrics.mcpConnectDurationMs += Math.max(0, result.value.connectDurationMs);
      if (result.value.lease.status === "reused") {
        metrics.mcpReusedCount += 1;
      } else {
        metrics.mcpConnectedCount += 1;
      }
      if (result.value.lease.isEphemeral) {
        metrics.mcpEphemeralConnectCount += 1;
      }
      continue;
    }

    if (!firstError) {
      firstError = result.reason instanceof Error
        ? result.reason
        : new Error(String(result.reason));
    }
  }

  if (firstError) {
    await Promise.allSettled(successfulResults.map((result) => options.releaseLease(result.lease)));
    throw firstError;
  }

  metrics.mcpSetupDurationMs = Math.max(0, Date.now() - setupStartedAtMs);

  return {
    servers: successfulResults.map((result) => result.server),
    leases: successfulResults.map((result) => result.lease),
    metrics,
  };
}

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

type CleanupChatRuntimeOptions<TLease extends { release: () => Promise<void> }> = {
  codeInterpreterContainerId: string;
  deleteCodeInterpreterContainer: (containerId: string) => Promise<void>;
  mcpServerLeases: TLease[];
  awaitWithTimeout: <T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string) => Promise<T>;
  cleanupTimeoutMs: number;
};

export async function cleanupChatRuntime<TLease extends { release: () => Promise<void> }>(
  options: CleanupChatRuntimeOptions<TLease>,
): Promise<void> {
  await Promise.allSettled([
    options.awaitWithTimeout(
      (async () => {
        if (!options.codeInterpreterContainerId) {
          return;
        }
        await options.deleteCodeInterpreterContainer(options.codeInterpreterContainerId);
      })(),
      options.cleanupTimeoutMs,
      "Timed out while cleaning up the Code Interpreter container.",
    ),
    options.awaitWithTimeout(
      Promise.allSettled(options.mcpServerLeases.map((lease) => lease.release())).then(
        () => undefined,
      ),
      options.cleanupTimeoutMs,
      "Timed out while releasing MCP server sessions.",
    ),
  ]);
}
