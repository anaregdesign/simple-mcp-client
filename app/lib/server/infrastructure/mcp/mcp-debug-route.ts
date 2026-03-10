import {
  installGlobalServerErrorLogging,
  logServerRouteEvent,
} from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import {
  createDatabaseDebugMcpServer,
  ensureMcpDebugReady,
} from "~/lib/server/infrastructure/mcp/mcp-debug-server";
import {
  createMcpJsonTransport,
  jsonRpcErrorResponse,
  jsonRpcMethodNotAllowedResponse,
} from "~/lib/server/infrastructure/mcp/mcp-transport";

const MCP_DEBUG_ROUTE_PATH = "/mcp/debug";

export async function handleMcpDebugRouteRequest(
  request: Request,
): Promise<Response> {
  if (!isDevelopmentMcpDebugRequest()) {
    return jsonRpcErrorResponse(404, -32004, "Not found.");
  }

  if (request.method !== "POST") {
    return jsonRpcMethodNotAllowedResponse(MCP_DEBUG_ROUTE_PATH);
  }

  const server = createDatabaseDebugMcpServer();
  const transport = createMcpJsonTransport();

  try {
    await ensureMcpDebugReady();
    await server.connect(transport);
    return await transport.handleRequest(request);
  } catch (error) {
    await logServerRouteEvent({
      request,
      route: MCP_DEBUG_ROUTE_PATH,
      eventName: "mcp_debug_route_failed",
      action: "handle_mcp_request",
      statusCode: 500,
      error,
    });

    return jsonRpcErrorResponse(500, -32603, "Internal server error.");
  } finally {
    await Promise.allSettled([transport.close(), server.close()]);
  }
}

export function installMcpDebugRouteErrorLogging() {
  installGlobalServerErrorLogging();
}

function isDevelopmentMcpDebugRequest(): boolean {
  return process.env.NODE_ENV === "development";
}
