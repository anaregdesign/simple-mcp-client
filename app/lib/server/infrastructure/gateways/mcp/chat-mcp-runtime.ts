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
