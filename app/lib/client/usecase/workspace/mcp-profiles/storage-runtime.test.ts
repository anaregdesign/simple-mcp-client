import { beforeEach, describe, expect, it, vi } from "vitest";
import type { McpHttpServerConfig } from "~/lib/contracts/mcp/profile";

vi.mock("~/lib/client/usecase/workspace/mcp-profiles/controller", () => ({
  createWorkspaceMcpProfileOperationDeps: vi.fn((options) => options),
}));

vi.mock("~/lib/client/usecase/workspace/mcp-profiles/operations", () => ({
  applyWorkspaceMcpServerProfiles: vi.fn(),
  clearWorkspaceMcpServerProfilesState: vi.fn(),
  deleteWorkspaceMcpServerProfileFromConfig: vi.fn(async () => []),
  loadWorkspaceMcpServerProfiles: vi.fn(async () => {}),
  saveMcpServerToConfig: vi.fn(async () => ({
    profile: null,
    warning: null,
  })),
}));

vi.mock("~/lib/client/infrastructure/api/mcp-servers-api-client", () => ({
  mcpServersApiClient: {
    loadProfiles: vi.fn(async () => ({
      profiles: [],
    })),
    saveProfile: vi.fn(async () => ({
      profile: null,
      profiles: [],
      warning: null,
    })),
    deleteProfile: vi.fn(async () => ({
      profiles: [],
    })),
  },
}));

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
import {
  createWorkspaceMcpProfileStorageRuntime,
} from "~/lib/client/usecase/workspace/mcp-profiles/storage-runtime";

function createMcpServerConfig(
  overrides: Partial<McpHttpServerConfig> = {},
): McpHttpServerConfig {
  return {
    id: "server-1",
    name: "Server 1",
    transport: "streamable_http",
    url: "https://example.com/mcp",
    headers: {},
    useAzureAuth: false,
    azureAuthScope: "",
    timeoutSeconds: 30,
    ...overrides,
  };
}

describe("createWorkspaceMcpProfileStorageRuntime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("owns MCP profile api wiring and delegates operations", async () => {
    const runtime = createWorkspaceMcpProfileStorageRuntime({
      readActiveWorkspaceUserKey: () => "tenant::principal",
      nextWorkspaceMcpServerProfileRequestSeq: vi.fn(() => 1),
      readWorkspaceMcpServerProfileRequestSeq: vi.fn(() => 1),
      readWorkspaceMcpServerProfiles: vi.fn(() => []),
      writeWorkspaceMcpServerProfiles: vi.fn(),
      setWorkspaceMcpServerProfileError: vi.fn(),
      setIsLoadingWorkspaceMcpServerProfiles: vi.fn(),
      setEditingMcpServerId: vi.fn(),
      setIsDeletingWorkspaceMcpServerProfile: vi.fn(),
      markAzureAuthRequired: vi.fn(),
      logClientError: vi.fn(),
    });

    runtime.clearWorkspaceMcpServerProfilesState("Auth required");
    runtime.applyWorkspaceMcpServerProfiles([createMcpServerConfig()]);
    await runtime.loadWorkspaceMcpServerProfiles();
    await runtime.deleteWorkspaceMcpServerProfileFromConfig("server-1");
    await runtime.saveMcpServerToConfig(createMcpServerConfig(), {
      isUpdate: true,
    });

    const operationDeps = vi
      .mocked(createWorkspaceMcpProfileOperationDeps)
      .mock.results[0]?.value;
    await operationDeps?.loadProfiles({
      onAuthRequired: vi.fn(),
    });
    expect(mcpServersApiClient.loadProfiles).toHaveBeenCalledWith({
      onAuthRequired: expect.any(Function),
    });

    await operationDeps?.saveProfile(createMcpServerConfig(), {
      isUpdate: true,
      onAuthRequired: vi.fn(),
    });
    expect(mcpServersApiClient.saveProfile).toHaveBeenCalledWith(
      createMcpServerConfig(),
      {
        isUpdate: true,
        onAuthRequired: expect.any(Function),
      },
    );

    await operationDeps?.deleteProfile("server-1", {
      onAuthRequired: vi.fn(),
    });
    expect(mcpServersApiClient.deleteProfile).toHaveBeenCalledWith(
      "server-1",
      {
        onAuthRequired: expect.any(Function),
      },
    );

    expect(clearWorkspaceMcpServerProfilesState).toHaveBeenCalledWith(
      expect.objectContaining({
        readActiveWorkspaceUserKey: expect.any(Function),
      }),
      "Auth required",
    );
    expect(applyWorkspaceMcpServerProfiles).toHaveBeenCalledWith(
      expect.objectContaining({
        readWorkspaceMcpServerProfiles: expect.any(Function),
      }),
      [createMcpServerConfig()],
    );
    expect(loadWorkspaceMcpServerProfiles).toHaveBeenCalledTimes(1);
    expect(deleteWorkspaceMcpServerProfileFromConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        deleteProfile: expect.any(Function),
      }),
      "server-1",
    );
    expect(saveMcpServerToConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        saveProfile: expect.any(Function),
      }),
      createMcpServerConfig(),
      {
        isUpdate: true,
      },
    );
  });
});
