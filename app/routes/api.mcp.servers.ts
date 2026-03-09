/**
 * API route module for /api/mcp/servers.
 */
import {
  authRequiredResponse,
  methodNotAllowedResponse,
} from "~/lib/server/http";
import { readAuthenticatedUser } from "~/lib/server/infrastructure/auth/read-authenticated-user";
import {
  createMcpServerProfileService,
} from "~/lib/server/usecase/mcp/mcp-server-profile-service";
import {
  createWorkspaceMcpServerProfilePersistenceRepository,
} from "~/lib/server/infrastructure/repositories/workspace-mcp-server-profile-persistence-repository";
import {
  installGlobalServerErrorLogging,
} from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import {
  handleMcpServerCollectionAction,
  handleMcpServerCollectionLoader,
} from "~/lib/server/http/mcp/mcp-server-collection-action";
import type { Route } from "./+types/api.mcp.servers";
const MCP_SERVERS_COLLECTION_ALLOWED_METHODS = ["GET", "POST"] as const;

function getMcpServerProfileService() {
  return createMcpServerProfileService(
    createWorkspaceMcpServerProfilePersistenceRepository(),
  );
}

export async function loader({ request }: Route.LoaderArgs) {
  installGlobalServerErrorLogging();

  if (request.method !== "GET") {
    return methodNotAllowedResponse(MCP_SERVERS_COLLECTION_ALLOWED_METHODS);
  }

  const user = await readAuthenticatedUser();
  if (!user) {
    return authRequiredResponse();
  }

  return handleMcpServerCollectionLoader({
    request,
    userId: user.id,
    mcpServerProfileService: getMcpServerProfileService(),
  });
}

export async function action({ request }: Route.ActionArgs) {
  installGlobalServerErrorLogging();

  if (request.method !== "POST") {
    return methodNotAllowedResponse(MCP_SERVERS_COLLECTION_ALLOWED_METHODS);
  }

  const user = await readAuthenticatedUser();
  if (!user) {
    return authRequiredResponse();
  }

  return handleMcpServerCollectionAction({
    request,
    userId: user.id,
    mcpServerProfileService: getMcpServerProfileService(),
  });
}
