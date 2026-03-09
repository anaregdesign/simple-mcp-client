import { parseIncomingMcpServer } from "~/lib/contracts/mcp/server-config-parser";
import {
  errorResponse,
  invalidJsonResponse,
  readErrorMessage,
  readJsonPayload,
  validationErrorResponse,
} from "~/lib/server/http";
import { logServerRouteEvent } from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import type { McpServerProfileService } from "~/lib/server/usecase/mcp/mcp-server-profile-service";

const MCP_SERVERS_COLLECTION_ROUTE_PATH = "/api/mcp/servers";

export async function handleMcpServerCollectionLoader(options: {
  request: Request;
  userId: number;
  mcpServerProfileService: McpServerProfileService;
}): Promise<Response> {
  const { request, userId, mcpServerProfileService } = options;

  try {
    await mcpServerProfileService.ensureDefaultMcpServersForUser(userId);
    const profiles =
      await mcpServerProfileService.readWorkspaceMcpServerProfiles(userId);
    return Response.json({ profiles });
  } catch (error) {
    await logServerRouteEvent({
      request,
      route: MCP_SERVERS_COLLECTION_ROUTE_PATH,
      eventName: "read_mcp_servers_failed",
      action: "read_saved_profiles",
      statusCode: 500,
      error,
      userId,
    });

    return errorResponse({
      status: 500,
      code: "read_mcp_servers_failed",
      error: `Failed to read MCP servers from database: ${readErrorMessage(error)}`,
    });
  }
}

export async function handleMcpServerCollectionAction(options: {
  request: Request;
  userId: number;
  mcpServerProfileService: McpServerProfileService;
}): Promise<Response> {
  const { request, userId, mcpServerProfileService } = options;
  const payload = await readJsonPayload(request);
  if (!payload.ok) {
    await logServerRouteEvent({
      request,
      route: MCP_SERVERS_COLLECTION_ROUTE_PATH,
      eventName: "invalid_json_body",
      action: "parse_request_body",
      level: "warning",
      statusCode: 400,
      message: "Invalid JSON body.",
      userId,
    });

    return invalidJsonResponse();
  }

  if (
    payload.value &&
    typeof payload.value === "object" &&
    "id" in payload.value &&
    payload.value.id !== undefined
  ) {
    await logServerRouteEvent({
      request,
      route: MCP_SERVERS_COLLECTION_ROUTE_PATH,
      eventName: "invalid_mcp_server_payload",
      action: "validate_payload",
      level: "warning",
      statusCode: 422,
      message: "`id` must not be provided for POST.",
      userId,
    });

    return validationErrorResponse(
      "invalid_mcp_server_payload",
      "`id` must not be provided for POST.",
    );
  }

  const incomingResult = parseIncomingMcpServer(payload.value);
  if (!incomingResult.ok) {
    await logServerRouteEvent({
      request,
      route: MCP_SERVERS_COLLECTION_ROUTE_PATH,
      eventName: "invalid_mcp_server_payload",
      action: "validate_payload",
      level: "warning",
      statusCode: 422,
      message: incomingResult.error,
      userId,
    });

    return validationErrorResponse(
      "invalid_mcp_server_payload",
      incomingResult.error,
    );
  }

  try {
    const currentProfiles =
      await mcpServerProfileService.readWorkspaceMcpServerProfiles(userId);
    const profilesWithDefaults =
      mcpServerProfileService.mergeDefaultWorkspaceMcpServerProfiles(
        currentProfiles,
        userId,
      );
    const existingIds = new Set(
      profilesWithDefaults.map((profile) => profile.id),
    );
    const { profile, profiles, warning } =
      mcpServerProfileService.upsertWorkspaceMcpServerProfile(
        userId,
        profilesWithDefaults,
        incomingResult.value,
      );

    await mcpServerProfileService.writeWorkspaceMcpServerProfiles(
      userId,
      profiles,
    );
    const created = !existingIds.has(profile.id);
    const status = created ? 201 : 200;

    if (warning) {
      await logServerRouteEvent({
        request,
        route: MCP_SERVERS_COLLECTION_ROUTE_PATH,
        eventName: "mcp_server_duplicate_reused",
        action: "upsert_saved_profile",
        level: "warning",
        statusCode: status,
        message: warning,
        userId,
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
      route: MCP_SERVERS_COLLECTION_ROUTE_PATH,
      eventName: "save_mcp_servers_failed",
      action: "write_saved_profiles",
      statusCode: 500,
      error,
      userId,
    });

    return errorResponse({
      status: 500,
      code: "save_mcp_servers_failed",
      error: `Failed to update MCP servers in database: ${readErrorMessage(error)}`,
    });
  }
}
