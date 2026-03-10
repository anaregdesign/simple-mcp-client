import {
  mcpServersApiClient,
} from "~/lib/client/infrastructure/api/mcp-servers-api-client";
import {
  createWorkspaceMcpProfileOperationDeps,
} from "~/lib/client/usecase/workspace/mcp-profiles/controller";
import {
  applyWorkspaceMcpServerProfiles,
  clearWorkspaceMcpServerProfilesState,
  deleteWorkspaceMcpServerProfileFromConfig,
  loadWorkspaceMcpServerProfiles,
  saveMcpServerToConfig,
} from "~/lib/client/usecase/workspace/mcp-profiles/operations";
import type { McpServerConfig } from "~/lib/contracts/mcp/profile";

type WorkspaceMcpProfileOperationDepsOptions =
  Parameters<typeof createWorkspaceMcpProfileOperationDeps>[0];

type CreateWorkspaceMcpProfileStorageRuntimeOptions = Omit<
  WorkspaceMcpProfileOperationDepsOptions,
  "loadProfiles" | "saveProfile" | "deleteProfile"
>;

export function createWorkspaceMcpProfileStorageRuntime(
  options: CreateWorkspaceMcpProfileStorageRuntimeOptions,
) {
  const buildOperationDeps = () =>
    createWorkspaceMcpProfileOperationDeps({
      ...options,
      loadProfiles: (loadOptions) => mcpServersApiClient.loadProfiles(loadOptions),
      saveProfile: (server, saveOptions) =>
        mcpServersApiClient.saveProfile(server, saveOptions),
      deleteProfile: (serverId, deleteOptions) =>
        mcpServersApiClient.deleteProfile(serverId, deleteOptions),
    });

  return {
    clearWorkspaceMcpServerProfilesState(nextError?: string | null): void {
      clearWorkspaceMcpServerProfilesState(buildOperationDeps(), nextError);
    },

    applyWorkspaceMcpServerProfiles(profiles: McpServerConfig[]): void {
      applyWorkspaceMcpServerProfiles(buildOperationDeps(), profiles);
    },

    async loadWorkspaceMcpServerProfiles(): Promise<void> {
      await loadWorkspaceMcpServerProfiles(buildOperationDeps());
    },

    async deleteWorkspaceMcpServerProfileFromConfig(
      serverId: string,
    ): Promise<McpServerConfig[]> {
      return await deleteWorkspaceMcpServerProfileFromConfig(
        buildOperationDeps(),
        serverId,
      );
    },

    async saveMcpServerToConfig(
      server: McpServerConfig,
      saveOptions: {
        isUpdate?: boolean;
      } = {},
    ): Promise<{
      profile: McpServerConfig;
      warning: string | null;
    }> {
      return await saveMcpServerToConfig(
        buildOperationDeps(),
        server,
        saveOptions,
      );
    },
  };
}
