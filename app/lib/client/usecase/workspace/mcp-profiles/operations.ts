import { ClientApiError, mapApiError } from "~/lib/client/infrastructure/api/api-client";
import type { McpServersSnapshot } from "~/lib/client/infrastructure/api/mcp-servers-api-client";
import type { McpServerConfig } from "~/lib/contracts/mcp/profile";
import { upsertMcpServer } from "~/lib/client/usecase/workspace/mcp-profiles/mcp-server-collection";

type WorkspaceMcpServerProfileLogOptions = {
  category?: string;
  location?: string;
  action?: string;
  statusCode?: number;
  context?: Record<string, unknown>;
};

type WorkspaceMcpServerProfileOperationsDependencies = {
  readActiveWorkspaceUserKey: () => string;
  nextWorkspaceMcpServerProfileRequestSeq: () => number;
  readWorkspaceMcpServerProfileRequestSeq: () => number;
  readWorkspaceMcpServerProfiles: () => McpServerConfig[];
  writeWorkspaceMcpServerProfiles: (profiles: McpServerConfig[]) => void;
  setWorkspaceMcpServerProfileError: (value: string | null) => void;
  setIsLoadingWorkspaceMcpServerProfiles: (value: boolean) => void;
  setEditingMcpServerId: (value: string) => void;
  setIsDeletingWorkspaceMcpServerProfile: (value: boolean) => void;
  markAzureAuthRequired: () => void;
  loadProfiles: (options: {
    onAuthRequired?: () => void;
  }) => Promise<McpServersSnapshot>;
  saveProfile: (
    server: McpServerConfig,
    options: {
      isUpdate?: boolean;
      onAuthRequired?: () => void;
    },
  ) => Promise<McpServersSnapshot>;
  deleteProfile: (
    serverId: string,
    options: {
      onAuthRequired?: () => void;
    },
  ) => Promise<McpServersSnapshot>;
  logClientError: (
    eventName: string,
    error: unknown,
    options?: WorkspaceMcpServerProfileLogOptions,
  ) => void;
};

export function applyWorkspaceMcpServerProfiles(
  deps: WorkspaceMcpServerProfileOperationsDependencies,
  profiles: McpServerConfig[],
): void {
  deps.writeWorkspaceMcpServerProfiles(profiles);
}

export function clearWorkspaceMcpServerProfilesState(
  deps: WorkspaceMcpServerProfileOperationsDependencies,
  nextError: string | null = null,
): void {
  deps.setEditingMcpServerId("");
  deps.setIsDeletingWorkspaceMcpServerProfile(false);
  applyWorkspaceMcpServerProfiles(deps, []);
  deps.setWorkspaceMcpServerProfileError(nextError);
  deps.setIsLoadingWorkspaceMcpServerProfiles(false);
}

export async function loadWorkspaceMcpServerProfiles(
  deps: WorkspaceMcpServerProfileOperationsDependencies,
): Promise<void> {
  const expectedUserKey = deps.readActiveWorkspaceUserKey().trim();
  if (!expectedUserKey) {
    clearWorkspaceMcpServerProfilesState(deps);
    return;
  }

  const requestSeq = deps.nextWorkspaceMcpServerProfileRequestSeq();
  deps.setIsLoadingWorkspaceMcpServerProfiles(true);

  try {
    const result = await deps.loadProfiles({
      onAuthRequired: () => {
        deps.markAzureAuthRequired();
        clearWorkspaceMcpServerProfilesState(
          deps,
          "Azure login is required. Open Settings and sign in to load MCP servers.",
        );
      },
    });
    if (requestSeq !== deps.readWorkspaceMcpServerProfileRequestSeq()) {
      return;
    }
    if (expectedUserKey !== deps.readActiveWorkspaceUserKey().trim()) {
      return;
    }

    applyWorkspaceMcpServerProfiles(deps, result.profiles);
    deps.setWorkspaceMcpServerProfileError(null);
  } catch (loadError) {
    if (requestSeq !== deps.readWorkspaceMcpServerProfileRequestSeq()) {
      return;
    }
    if (expectedUserKey !== deps.readActiveWorkspaceUserKey().trim()) {
      return;
    }
    if (
      loadError instanceof ClientApiError &&
      loadError.kind === "auth_required"
    ) {
      return;
    }

    deps.logClientError("load_saved_mcp_servers_failed", loadError, {
      action: "load_saved_mcp_servers",
      statusCode: 500,
    });
    deps.setWorkspaceMcpServerProfileError(
      mapApiError(loadError, "Failed to load saved MCP servers."),
    );
  } finally {
    if (
      requestSeq === deps.readWorkspaceMcpServerProfileRequestSeq() &&
      expectedUserKey === deps.readActiveWorkspaceUserKey().trim()
    ) {
      deps.setIsLoadingWorkspaceMcpServerProfiles(false);
    }
  }
}

export async function saveMcpServerToConfig(
  deps: WorkspaceMcpServerProfileOperationsDependencies,
  server: McpServerConfig,
  options: {
    isUpdate?: boolean;
  } = {},
): Promise<{
  profile: McpServerConfig;
  warning: string | null;
}> {
  const result = await deps.saveProfile(server, {
    isUpdate: options.isUpdate,
    onAuthRequired: () => {
      deps.markAzureAuthRequired();
    },
  });

  const profile = result.profile;
  if (!profile) {
    throw new Error("Saved MCP server response is invalid.");
  }

  if (result.profiles.length > 0) {
    applyWorkspaceMcpServerProfiles(deps, result.profiles);
  } else {
    applyWorkspaceMcpServerProfiles(
      deps,
      upsertMcpServer(deps.readWorkspaceMcpServerProfiles(), profile),
    );
  }

  return {
    profile,
    warning: result.warning,
  };
}

export async function deleteWorkspaceMcpServerProfileFromConfig(
  deps: WorkspaceMcpServerProfileOperationsDependencies,
  serverId: string,
): Promise<McpServerConfig[]> {
  const result = await deps.deleteProfile(serverId, {
    onAuthRequired: () => {
      deps.markAzureAuthRequired();
    },
  });

  return result.profiles;
}
