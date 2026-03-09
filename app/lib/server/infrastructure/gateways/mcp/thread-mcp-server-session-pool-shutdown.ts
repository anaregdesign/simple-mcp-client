/**
 * Runtime support module for MCP session-pool shutdown hooks.
 */
import { closeAllThreadMcpServerSessions } from "~/lib/server/infrastructure/gateways/mcp/thread-mcp-server-session-pool";

type ShutdownSignal = "SIGINT" | "SIGTERM";
type ShutdownHookProcess = {
  once: (event: ShutdownSignal | "beforeExit", listener: () => void) => void;
};

type RegisterShutdownHookOptions = {
  processRef?: ShutdownHookProcess;
  closeAllSessions?: () => Promise<void>;
};

let hasRegisteredThreadMcpServerSessionPoolShutdownHooks = false;

export function registerThreadMcpServerSessionPoolShutdownHooks(
  options: RegisterShutdownHookOptions = {},
): void {
  if (hasRegisteredThreadMcpServerSessionPoolShutdownHooks) {
    return;
  }

  const processRef = options.processRef ?? process;
  const closeAllSessions = options.closeAllSessions ?? closeAllThreadMcpServerSessions;
  const closeSessions = () => {
    void closeAllSessions().catch(() => undefined);
  };

  processRef.once("beforeExit", closeSessions);
  processRef.once("SIGINT", closeSessions);
  processRef.once("SIGTERM", closeSessions);

  hasRegisteredThreadMcpServerSessionPoolShutdownHooks = true;
}

export const threadMcpServerSessionPoolShutdownTestUtils = {
  resetRegistration(): void {
    hasRegisteredThreadMcpServerSessionPoolShutdownHooks = false;
  },
};
