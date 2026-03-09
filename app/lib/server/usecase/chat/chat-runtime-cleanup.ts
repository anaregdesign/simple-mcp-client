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
