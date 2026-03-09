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

const MCP_SERVER_ITEM_ROUTE_PATH = "/api/mcp/servers/:serverId";

export async function handleMcpServerItemAction(options: {
  request: Request;
  userId: number;
  serverIdParam: unknown;
  mcpServerProfileService: McpServerProfileService;
}): Promise<Response> {
  const { request, userId, serverIdParam, mcpServerProfileService } = options;
  const serverId =
    typeof serverIdParam === "string" ? serverIdParam.trim() : "";
  if (!serverId) {
    return validationErrorResponse(
      "invalid_mcp_server_id",
      "Invalid MCP server id.",
    );
  }

  if (request.method === "DELETE") {
    try {
      const currentProfiles =
        await mcpServerProfileService.readWorkspaceMcpServerProfiles(userId);
      const deleteResult =
        mcpServerProfileService.deleteWorkspaceMcpServerProfile(
          currentProfiles,
          serverId,
        );
      if (!deleteResult.deleted) {
        return errorResponse({
          status: 404,
          code: "mcp_server_not_found",
          error: "Selected MCP server is not available.",
        });
      }

      await mcpServerProfileService.writeWorkspaceMcpServerProfiles(
        userId,
        deleteResult.profiles,
      );
      return Response.json({ profiles: deleteResult.profiles });
    } catch (error) {
      await logServerRouteEvent({
        request,
        route: MCP_SERVER_ITEM_ROUTE_PATH,
        eventName: "delete_mcp_server_failed",
        action: "delete_saved_profile",
        statusCode: 500,
        error,
        userId,
        context: {
          serverId,
        },
      });

      return errorResponse({
        status: 500,
        code: "delete_mcp_server_failed",
        error: `Failed to delete MCP server in database: ${readErrorMessage(error)}`,
      });
    }
  }

  const payload = await readJsonPayload(request);
  if (!payload.ok) {
    return invalidJsonResponse();
  }

  const parsed = parseIncomingMcpServer(payload.value);
  if (!parsed.ok) {
    return validationErrorResponse("invalid_mcp_server_payload", parsed.error);
  }

  if ("id" in parsed.value && parsed.value.id && parsed.value.id !== serverId) {
    return validationErrorResponse(
      "mcp_server_id_mismatch",
      "`id` must match path `serverId`.",
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
    const hasTargetProfile = profilesWithDefaults.some(
      (profile) => profile.id === serverId,
    );
    if (!hasTargetProfile) {
      return errorResponse({
        status: 404,
        code: "mcp_server_not_found",
        error: "Selected MCP server is not available.",
      });
    }

    const profilesWithoutTarget = profilesWithDefaults.filter(
      (profile) => profile.id !== serverId,
    );
    const { profile, profiles, warning } =
      mcpServerProfileService.upsertWorkspaceMcpServerProfile(
        userId,
        profilesWithoutTarget,
        {
          ...parsed.value,
          id: serverId,
        },
      );

    await mcpServerProfileService.writeWorkspaceMcpServerProfiles(
      userId,
      profiles,
    );
    return Response.json({ profile, profiles, warning });
  } catch (error) {
    await logServerRouteEvent({
      request,
      route: MCP_SERVER_ITEM_ROUTE_PATH,
      eventName: "update_mcp_server_failed",
      action: "update_saved_profile",
      statusCode: 500,
      error,
      userId,
      context: {
        serverId,
      },
    });

    return errorResponse({
      status: 500,
      code: "update_mcp_server_failed",
      error: `Failed to update MCP server in database: ${readErrorMessage(error)}`,
    });
  }
}
