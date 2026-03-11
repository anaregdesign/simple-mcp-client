/**
 * MCP route module for /mcp/cmd shell command server.
 */
import {
  handleMcpCmdRouteRequest,
  installMcpCmdRouteErrorLogging,
} from "~/lib/server/infrastructure/mcp/mcp-cmd-route";

export async function loader({ request }: { request: Request }) {
  installMcpCmdRouteErrorLogging();
  return await handleMcpCmdRouteRequest(request);
}

export async function action({ request }: { request: Request }) {
  installMcpCmdRouteErrorLogging();
  return await handleMcpCmdRouteRequest(request);
}
