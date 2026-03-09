/**
 * MCP route module for /mcp/debug database debug server.
 */
import {
  createMcpJsonTransport,
  jsonRpcErrorResponse,
} from "~/lib/server/http/mcp/mcp-transport";
import {
  createDatabaseDebugMcpServer,
  ensureMcpDebugReady,
} from "~/lib/server/http/mcp/mcp-debug-server";
import {
  installGlobalServerErrorLogging,
  logServerRouteEvent,
} from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";

const MCP_DEBUG_ROUTE_PATH = "/mcp/debug";

export async function loader({ request }: { request: Request }) {
  installGlobalServerErrorLogging();
  return handleMcpRequest(request);
}

export async function action({ request }: { request: Request }) {
  installGlobalServerErrorLogging();
  return handleMcpRequest(request);
}

async function handleMcpRequest(request: Request): Promise<Response> {
  if (!isDevelopmentMcpDebugRequest()) {
    return jsonRpcErrorResponse(404, -32004, "Not found.");
  }

  if (request.method !== "POST") {
    return jsonRpcErrorResponse(
      405,
      -32000,
      `Method not allowed. Use POST ${MCP_DEBUG_ROUTE_PATH}.`,
    );
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
    await Promise.allSettled([
      transport.close(),
      server.close(),
    ]);
  }
}

function isDevelopmentMcpDebugRequest(): boolean {
  return process.env.NODE_ENV === "development";
}
