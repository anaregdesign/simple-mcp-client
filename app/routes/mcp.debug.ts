/**
 * MCP route module for /mcp/debug database debug server.
 */
import {
  handleMcpDebugRouteRequest,
  installMcpDebugRouteErrorLogging,
} from "~/lib/server/infrastructure/mcp/mcp-debug-route";

export async function loader({ request }: { request: Request }) {
  installMcpDebugRouteErrorLogging();
  return await handleMcpDebugRouteRequest(request);
}

export async function action({ request }: { request: Request }) {
  installMcpDebugRouteErrorLogging();
  return await handleMcpDebugRouteRequest(request);
}
