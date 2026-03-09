/**
 * API route module for /api/mcp/servers.
 */
import {
  authRequiredResponse,
  methodNotAllowedResponse,
} from "~/lib/server/http";
import { readAuthenticatedUser } from "~/lib/server/infrastructure/auth/read-authenticated-user";
import {
  installGlobalServerErrorLogging,
} from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import {
  handleMcpServerCollectionAction,
  handleMcpServerCollectionLoader,
} from "~/lib/server/http/mcp/mcp-server-collection-action";
import {
  createMcpServerProfileServiceWithInfrastructure,
} from "~/lib/server/infrastructure/mcp/mcp-server-profile-service-factory";
import type { Route } from "./+types/api.mcp.servers";
const MCP_SERVERS_COLLECTION_ALLOWED_METHODS = ["GET", "POST"] as const;

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
    mcpServerProfileService: createMcpServerProfileServiceWithInfrastructure(),
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
    mcpServerProfileService: createMcpServerProfileServiceWithInfrastructure(),
  });
}
