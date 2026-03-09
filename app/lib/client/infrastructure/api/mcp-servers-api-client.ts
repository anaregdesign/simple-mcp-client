import {
  requestClientApi,
  resolveAuthRequired,
} from "~/lib/client/infrastructure/api/api-client";
import { readJsonPayload } from "~/lib/client/infrastructure/api/http";
import {
  readMcpServerFromWorkspaceProfileResource,
  readWorkspaceMcpServerProfileResourceList,
  serializeMcpServerForSave,
  type McpServerConfig,
  type WorkspaceMcpServerProfileResource,
} from "~/lib/contracts/mcp/profile";
import { isMcpServersAuthRequired } from "~/lib/client/infrastructure/api/mcp-servers-auth-state";

type McpServersApiResponse = {
  profile?: WorkspaceMcpServerProfileResource;
  profiles?: WorkspaceMcpServerProfileResource[];
  warning?: string;
  authRequired?: boolean;
  error?: string;
};

export type McpServersSnapshot = {
  profileResource: WorkspaceMcpServerProfileResource | null;
  profileResources: WorkspaceMcpServerProfileResource[];
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
  const profileResources = readWorkspaceMcpServerProfileResourceList(payload.profiles);
  const profileResource = payload.profile
    ? readWorkspaceMcpServerProfileResourceList([payload.profile])[0] ?? null
    : null;

  return {
    profileResource,
    profileResources,
    profile: profileResource ? readMcpServerFromWorkspaceProfileResource(profileResource) : null,
    profiles: profileResources
      .map((profile) => readMcpServerFromWorkspaceProfileResource(profile))
      .filter((profile): profile is McpServerConfig => profile !== null),
    warning: typeof payload.warning === "string" ? payload.warning : null,
    payload,
  };
}
