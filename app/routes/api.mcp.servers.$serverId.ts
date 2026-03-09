/**
 * API route module for /api/mcp/servers/:serverId.
 */
import {
  authRequiredResponse,
  methodNotAllowedResponse,
} from "~/lib/server/http";
import {
  installGlobalServerErrorLogging,
} from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import { readAuthenticatedUser } from "~/lib/server/infrastructure/auth/read-authenticated-user";
import { handleMcpServerItemAction } from "~/lib/server/http/mcp/mcp-server-item-action";
import {
  createMcpServerProfileServiceWithInfrastructure,
} from "~/lib/server/infrastructure/mcp/mcp-server-profile-service-factory";
import type { Route } from "./+types/api.mcp.servers.$serverId";

const MCP_SERVER_ITEM_ALLOWED_METHODS = ["PUT", "DELETE"] as const;

export function loader() {
  installGlobalServerErrorLogging();
  return methodNotAllowedResponse(MCP_SERVER_ITEM_ALLOWED_METHODS);
}

export async function action({ request, params }: Route.ActionArgs) {
  installGlobalServerErrorLogging();

  if (request.method !== "PUT" && request.method !== "DELETE") {
    return methodNotAllowedResponse(MCP_SERVER_ITEM_ALLOWED_METHODS);
  }

  const user = await readAuthenticatedUser();
  if (!user) {
    return authRequiredResponse();
  }

  return handleMcpServerItemAction({
    request,
    userId: user.id,
    serverIdParam: params.serverId,
    mcpServerProfileService: createMcpServerProfileServiceWithInfrastructure(),
  });
}
