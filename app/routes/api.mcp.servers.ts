/**
 * API route module for /api/mcp/servers.
 */
import {
  mcpServerProfileService,
  mcpServersRouteTestUtils,
  parseIncomingMcpServer,
  readAuthenticatedUser,
  readErrorMessage,
} from "~/lib/server/application/mcp/mcp-server-profile-service";
import {
  authRequiredResponse,
  errorResponse,
  invalidJsonResponse,
  methodNotAllowedResponse,
  validationErrorResponse,
} from "~/lib/server/http";
import {
  installGlobalServerErrorLogging,
  logServerRouteEvent,
} from "~/lib/server/observability/runtime-event-log";
import type { Route } from "./+types/api.mcp.servers";

export { mcpServersRouteTestUtils, parseIncomingMcpServer };

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

  try {
    await mcpServerProfileService.ensureDefaultMcpServersForUser(user.id);
    const profiles = await mcpServerProfileService.readWorkspaceMcpServerProfiles(user.id);
    return Response.json({ profiles });
  } catch (error) {
    await logServerRouteEvent({
      request,
      route: "/api/mcp/servers",
      eventName: "read_mcp_servers_failed",
      action: "read_saved_profiles",
      statusCode: 500,
      error,
      userId: user.id,
    });

    return errorResponse({
      status: 500,
      code: "read_mcp_servers_failed",
      error: `Failed to read MCP servers from database: ${readErrorMessage(error)}`,
    });
  }
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

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    await logServerRouteEvent({
      request,
      route: "/api/mcp/servers",
      eventName: "invalid_json_body",
      action: "parse_request_body",
      level: "warning",
      statusCode: 400,
      message: "Invalid JSON body.",
      userId: user.id,
    });

    return invalidJsonResponse();
  }

  if (payload && typeof payload === "object" && "id" in payload && payload.id !== undefined) {
    await logServerRouteEvent({
      request,
      route: "/api/mcp/servers",
      eventName: "invalid_mcp_server_payload",
      action: "validate_payload",
      level: "warning",
      statusCode: 422,
      message: "`id` must not be provided for POST.",
      userId: user.id,
    });

    return validationErrorResponse(
      "invalid_mcp_server_payload",
      "`id` must not be provided for POST.",
    );
  }

  const incomingResult = parseIncomingMcpServer(payload);
  if (!incomingResult.ok) {
    await logServerRouteEvent({
      request,
      route: "/api/mcp/servers",
      eventName: "invalid_mcp_server_payload",
      action: "validate_payload",
      level: "warning",
      statusCode: 422,
      message: incomingResult.error,
      userId: user.id,
    });

    return validationErrorResponse("invalid_mcp_server_payload", incomingResult.error);
  }

  try {
    const currentProfiles = await mcpServerProfileService.readWorkspaceMcpServerProfiles(user.id);
    const profilesWithDefaults = mcpServerProfileService.mergeDefaultWorkspaceMcpServerProfiles(
      currentProfiles,
      user.id,
    );
    const existingIds = new Set(profilesWithDefaults.map((profile) => profile.id));
    const { profile, profiles, warning } = mcpServerProfileService.upsertWorkspaceMcpServerProfile(
      profilesWithDefaults,
      incomingResult.value,
    );

    await mcpServerProfileService.writeWorkspaceMcpServerProfiles(user.id, profiles);
    const created = !existingIds.has(profile.id);
    const status = created ? 201 : 200;

    if (warning) {
      await logServerRouteEvent({
        request,
        route: "/api/mcp/servers",
        eventName: "mcp_server_duplicate_reused",
        action: "upsert_saved_profile",
        level: "warning",
        statusCode: status,
        message: warning,
        userId: user.id,
        context: {
          profileId: profile.id,
          transport: profile.transport,
        },
      });
    }

    return Response.json(
      { profile, profiles, warning },
      {
        status,
        headers: created
          ? {
              Location: `/api/mcp/servers/${encodeURIComponent(profile.id)}`,
            }
          : undefined,
      },
    );
  } catch (error) {
    await logServerRouteEvent({
      request,
      route: "/api/mcp/servers",
      eventName: "save_mcp_servers_failed",
      action: "write_saved_profiles",
      statusCode: 500,
      error,
      userId: user.id,
    });

    return errorResponse({
      status: 500,
      code: "save_mcp_servers_failed",
      error: `Failed to update MCP servers in database: ${readErrorMessage(error)}`,
    });
  }
}
