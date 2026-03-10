import { describe, expect, it, vi } from "vitest";
import type { McpServersSnapshot } from "~/lib/client/infrastructure/api/mcp-servers-api-client";
import type { McpServerConfig } from "~/lib/contracts/mcp/profile";
import {
  loadWorkspaceMcpServerProfiles,
  saveMcpServerToConfig,
} from "./operations";

function createMcpServerConfig(id = "srv-1"): McpServerConfig {
  return {
    id,
    name: "filesystem",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
    env: {},
  };
}

function createMcpServersSnapshot(
  overrides: Partial<McpServersSnapshot> = {},
): McpServersSnapshot {
  return {
    profileResource: null,
    profileResources: [],
    profile: null,
    profiles: [],
    warning: null,
    payload: {},
    ...overrides,
  };
}

function createDependencies(overrides: {
  loadProfiles?: (options: {
    onAuthRequired?: () => void;
  }) => Promise<McpServersSnapshot>;
  saveProfile?: (
    server: McpServerConfig,
    options: {
      isUpdate?: boolean;
      onAuthRequired?: () => void;
    },
  ) => Promise<McpServersSnapshot>;
} = {}) {
  const state = {
    activeWorkspaceUserKey: "tenant::principal",
    workspaceMcpServerProfileRequestSeq: 0,
    workspaceMcpServerProfiles: [createMcpServerConfig("existing")],
    workspaceMcpServerProfileError: "seed" as string | null,
    isLoadingWorkspaceMcpServerProfiles: false,
    editingMcpServerId: "existing",
    isDeletingWorkspaceMcpServerProfile: true,
    authRequiredCount: 0,
    logEvents: [] as string[],
  };

  const deps = {
    readActiveWorkspaceUserKey: () => state.activeWorkspaceUserKey,
    nextWorkspaceMcpServerProfileRequestSeq: () => {
      state.workspaceMcpServerProfileRequestSeq += 1;
      return state.workspaceMcpServerProfileRequestSeq;
    },
    readWorkspaceMcpServerProfileRequestSeq: () =>
      state.workspaceMcpServerProfileRequestSeq,
    readWorkspaceMcpServerProfiles: () => state.workspaceMcpServerProfiles,
    writeWorkspaceMcpServerProfiles: (profiles: McpServerConfig[]) => {
      state.workspaceMcpServerProfiles = profiles;
    },
    setWorkspaceMcpServerProfileError: (value: string | null) => {
      state.workspaceMcpServerProfileError = value;
    },
    setIsLoadingWorkspaceMcpServerProfiles: (value: boolean) => {
      state.isLoadingWorkspaceMcpServerProfiles = value;
    },
    setEditingMcpServerId: (value: string) => {
      state.editingMcpServerId = value;
    },
    setIsDeletingWorkspaceMcpServerProfile: (value: boolean) => {
      state.isDeletingWorkspaceMcpServerProfile = value;
    },
    markAzureAuthRequired: () => {
      state.authRequiredCount += 1;
    },
    loadProfiles:
      overrides.loadProfiles ??
      vi.fn(async () => {
        return createMcpServersSnapshot({
          profiles: [createMcpServerConfig()],
        });
      }),
    saveProfile:
      overrides.saveProfile ??
      vi.fn(async (server: McpServerConfig) => {
        return createMcpServersSnapshot({
          profile: server,
        });
      }),
    deleteProfile: vi.fn(),
    logClientError: (eventName: string) => {
      state.logEvents.push(eventName);
    },
  };

  return { deps, state };
}

describe("workspace-mcp-server-profile-operations", () => {
  it("clears saved MCP profile state when no workspace user is active", async () => {
    const { deps, state } = createDependencies();
    state.activeWorkspaceUserKey = "";

    await loadWorkspaceMcpServerProfiles(deps);

    expect(state.workspaceMcpServerProfiles).toEqual([]);
    expect(state.editingMcpServerId).toBe("");
    expect(state.isDeletingWorkspaceMcpServerProfile).toBe(false);
    expect(state.workspaceMcpServerProfileError).toBeNull();
    expect(state.isLoadingWorkspaceMcpServerProfiles).toBe(false);
  });

  it("upserts the saved profile when the server snapshot does not include the full list", async () => {
    const server = createMcpServerConfig("srv-2");
    const { deps, state } = createDependencies({
      saveProfile: vi.fn(async () => {
        return createMcpServersSnapshot({
          profile: server,
          profiles: [],
          warning: "Duplicate configuration reused.",
        });
      }),
    });

    const result = await saveMcpServerToConfig(deps, server);

    expect(result.profile).toEqual(server);
    expect(result.warning).toBe("Duplicate configuration reused.");
    expect(state.workspaceMcpServerProfiles).toEqual([
      createMcpServerConfig("existing"),
      server,
    ]);
  });
});
