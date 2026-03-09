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
import {
  createMcpServerProfileService,
} from "~/lib/server/usecase/mcp/mcp-server-profile-service";
import { readAuthenticatedUser } from "~/lib/server/infrastructure/auth/read-authenticated-user";
import {
  createWorkspaceMcpServerProfilePersistenceRepository,
} from "~/lib/server/infrastructure/repositories/workspace-mcp-server-profile-persistence-repository";
import { handleMcpServerItemAction } from "~/lib/server/http/mcp/mcp-server-item-action";
import type { Route } from "./+types/api.mcp.servers.$serverId";

const MCP_SERVER_ITEM_ALLOWED_METHODS = ["PUT", "DELETE"] as const;

function getMcpServerProfileService() {
  return createMcpServerProfileService(
    createWorkspaceMcpServerProfilePersistenceRepository(),
  );
}

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
    mcpServerProfileService: getMcpServerProfileService(),
  });
}
