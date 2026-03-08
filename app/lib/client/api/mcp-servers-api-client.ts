import {
  requestClientApi,
  resolveAuthRequired,
} from "~/lib/client/controller/api-client";
import { readJsonPayload } from "~/lib/client/controller/http";
import type { McpServersApiResponse } from "~/lib/client/controller/types";
import {
  readMcpServerFromUnknown,
  readMcpServerList,
  serializeMcpServerForSave,
  type McpServerConfig,
} from "~/lib/contracts/mcp/profile";
import { isMcpServersAuthRequired } from "~/lib/client/mcp/workspace-mcp-server-profiles";

export type McpServersSnapshot = {
  profile: McpServerConfig | null;
  profiles: McpServerConfig[];
  warning: string | null;
  payload: McpServersApiResponse;
};

type McpServersApiClientOptions = {
  onAuthRequired?: () => void;
  fetchImpl?: typeof fetch;
};

export class McpServersApiClient {
  async loadProfiles(
    options: McpServersApiClientOptions = {},
  ): Promise<McpServersSnapshot> {
    const { payload } = await requestClientApi<McpServersApiResponse>({
      url: "/api/mcp/servers",
      init: {
        method: "GET",
      },
      readPayload: (response) =>
        readJsonPayload<McpServersApiResponse>(response, "saved MCP servers"),
      resolveAuthRequired: (status, responsePayload) =>
        resolveAuthRequired(status, responsePayload, (rawPayload) =>
          isMcpServersAuthRequired(status, rawPayload as McpServersApiResponse),
        ),
      readErrorMessage: (responsePayload) =>
        typeof responsePayload.error === "string" ? responsePayload.error : null,
      fallbackErrorMessage: "Failed to load saved MCP servers.",
      authRequiredMessage:
        "Azure login is required. Open Settings and sign in to load MCP servers.",
      onAuthRequired: options.onAuthRequired,
      fetchImpl: options.fetchImpl,
    });

    return readMcpServersSnapshot(payload);
  }

  async saveProfile(
    server: McpServerConfig,
    options: McpServersApiClientOptions & {
      isUpdate?: boolean;
    } = {},
  ): Promise<McpServersSnapshot> {
    const endpoint =
      options.isUpdate === true
        ? `/api/mcp/servers/${encodeURIComponent(server.id)}`
        : "/api/mcp/servers";
    const method = options.isUpdate === true ? "PUT" : "POST";

    const { payload } = await requestClientApi<McpServersApiResponse>({
      url: endpoint,
      init: {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          serializeMcpServerForSave(server, {
            includeId: false,
          }),
        ),
      },
      readPayload: (response) =>
        readJsonPayload<McpServersApiResponse>(response, "saved MCP servers"),
      resolveAuthRequired: (status, responsePayload) =>
        resolveAuthRequired(status, responsePayload, (rawPayload) =>
          isMcpServersAuthRequired(status, rawPayload as McpServersApiResponse),
        ),
      readErrorMessage: (responsePayload) =>
        typeof responsePayload.error === "string" ? responsePayload.error : null,
      fallbackErrorMessage: "Failed to save MCP server.",
      authRequiredMessage:
        "Azure login is required. Open Settings and sign in to save MCP servers.",
      onAuthRequired: options.onAuthRequired,
      fetchImpl: options.fetchImpl,
    });

    return readMcpServersSnapshot(payload);
  }

  async deleteProfile(
    serverId: string,
    options: McpServersApiClientOptions = {},
  ): Promise<McpServersSnapshot> {
    const { payload } = await requestClientApi<McpServersApiResponse>({
      url: `/api/mcp/servers/${encodeURIComponent(serverId)}`,
      init: {
        method: "DELETE",
      },
      readPayload: (response) =>
        readJsonPayload<McpServersApiResponse>(response, "saved MCP servers"),
      resolveAuthRequired: (status, responsePayload) =>
        resolveAuthRequired(status, responsePayload, (rawPayload) =>
          isMcpServersAuthRequired(status, rawPayload as McpServersApiResponse),
        ),
      readErrorMessage: (responsePayload) =>
        typeof responsePayload.error === "string" ? responsePayload.error : null,
      fallbackErrorMessage: "Failed to delete MCP server.",
      authRequiredMessage:
        "Azure login is required. Open Settings and sign in to edit MCP servers.",
      onAuthRequired: options.onAuthRequired,
      fetchImpl: options.fetchImpl,
    });

    return readMcpServersSnapshot(payload);
  }
}

export const mcpServersApiClient = new McpServersApiClient();

function readMcpServersSnapshot(payload: McpServersApiResponse): McpServersSnapshot {
  return {
    profile: readMcpServerFromUnknown(payload.profile),
    profiles: readMcpServerList(payload.profiles),
    warning: typeof payload.warning === "string" ? payload.warning : null,
    payload,
  };
}
