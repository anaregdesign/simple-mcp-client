import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORKSPACE_MCP_SERVER_PROFILE_ROWS,
  MCP_DEFAULT_AZURE_AUTH_SCOPE,
  MCP_DEFAULT_TIMEOUT_SECONDS,
  MCP_LEGACY_UNAVAILABLE_DEFAULT_STDIO_NPX_PACKAGE_NAMES,
} from "~/lib/constants/mcp";
import {
  readMcpServerFromWorkspaceProfileResource,
  type McpHttpServerConfig,
  type McpServerConfig,
  type WorkspaceMcpServerProfileResource,
} from "~/lib/contracts/mcp/profile";
import {
  resolveDefaultFilesystemWorkingDirectory,
  resolveLegacyFilesystemWorkingDirectory,
} from "~/lib/server/infrastructure/config/workspace-mcp-server-default-paths";
import { buildMcpServerConfigKey } from "~/lib/domain/value-objects/mcp-server-config-key";
import {
  deleteWorkspaceMcpServerProfile,
  mergeDefaultWorkspaceMcpServerProfiles,
  upsertWorkspaceMcpServerProfile,
  type DefaultWorkspaceMcpServerProfile,
} from "./workspace-mcp-server-profile-policy";

const defaultWorkspaceUserId = 42;

function createHttpServer(
  overrides: Partial<McpHttpServerConfig> & {
    id: string;
    name: string;
    url: string;
  },
): McpHttpServerConfig {
  const { id, name, url, ...rest } = overrides;
  return {
    id,
    name,
    connectOnThreadCreate: false,
    transport: "streamable_http",
    url,
    headers: {},
    useAzureAuth: false,
    azureAuthScope: MCP_DEFAULT_AZURE_AUTH_SCOPE,
    timeoutSeconds: MCP_DEFAULT_TIMEOUT_SECONDS,
    ...rest,
  };
}

function createWorkspaceMcpServerProfileResource(
  profile: McpServerConfig,
  userId = defaultWorkspaceUserId,
  profileOrder = 0,
): WorkspaceMcpServerProfileResource {
  const configKey = buildMcpServerConfigKey(profile);
  if (profile.transport === "stdio") {
    return {
      id: profile.id,
      userId,
      profileOrder,
      connectOnThreadCreate: profile.connectOnThreadCreate === true,
      configKey,
      name: profile.name,
      transport: profile.transport,
      url: null,
      headersJson: null,
      useAzureAuth: false,
      azureAuthScope: null,
      timeoutSeconds: null,
      command: profile.command,
      argsJson: JSON.stringify(profile.args),
      cwd: profile.cwd ?? null,
      envJson: JSON.stringify(profile.env),
    };
  }

  return {
    id: profile.id,
    userId,
    profileOrder,
    connectOnThreadCreate: profile.connectOnThreadCreate === true,
    configKey,
    name: profile.name,
    transport: profile.transport,
    url: profile.url,
    headersJson: JSON.stringify(profile.headers),
    useAzureAuth: profile.useAzureAuth,
    azureAuthScope: profile.azureAuthScope,
    timeoutSeconds: profile.timeoutSeconds,
    command: null,
    argsJson: null,
    cwd: null,
    envJson: null,
  };
}

function createPolicyDependencies() {
  return {
    defaultProfiles:
      DEFAULT_WORKSPACE_MCP_SERVER_PROFILE_ROWS as readonly DefaultWorkspaceMcpServerProfile[],
    defaultFilesystemWorkingDirectory:
      resolveDefaultFilesystemWorkingDirectory(defaultWorkspaceUserId),
    legacyFilesystemWorkingDirectory:
      resolveLegacyFilesystemWorkingDirectory(),
    legacyUnavailableDefaultStdioNpxPackageNames:
      MCP_LEGACY_UNAVAILABLE_DEFAULT_STDIO_NPX_PACKAGE_NAMES,
    readConfig: readMcpServerFromWorkspaceProfileResource,
    createProfile: (profile: McpServerConfig & {
      userId: number;
      profileOrder: number;
    }) =>
      createWorkspaceMcpServerProfileResource(
        profile,
        profile.userId,
        profile.profileOrder,
      ),
    createId: () => "generated-id",
  };
}

describe("workspace-mcp-server-profile-policy", () => {
  it("reuses duplicate configuration and emits rename warning", () => {
    const currentProfiles = [
      createWorkspaceMcpServerProfileResource(
        createHttpServer({
          id: "profile-1",
          name: "Original Name",
          url: "https://example.com/mcp",
          headers: { Authorization: "Bearer token" },
        }),
      ),
    ];

    const result = upsertWorkspaceMcpServerProfile(currentProfiles, {
      ...createPolicyDependencies(),
      userId: defaultWorkspaceUserId,
      incoming: {
        id: "ignored-id",
        name: "Renamed Server",
        connectOnThreadCreate: false,
        transport: "streamable_http",
        url: "https://example.com/mcp",
        headers: { Authorization: "Bearer token" },
        useAzureAuth: false,
        azureAuthScope: MCP_DEFAULT_AZURE_AUTH_SCOPE,
        timeoutSeconds: MCP_DEFAULT_TIMEOUT_SECONDS,
      },
    });

    expect(result.profile.id).toBe("profile-1");
    expect(readMcpServerFromWorkspaceProfileResource(result.profile)?.name).toBe(
      "Renamed Server",
    );
    expect(result.warning).toBe(
      'An MCP server with the same configuration already exists. Renamed it from "Original Name" to "Renamed Server".',
    );
  });

  it("deletes matching profiles by id", () => {
    const currentProfiles = [
      createWorkspaceMcpServerProfileResource(
        createHttpServer({
          id: "profile-1",
          name: "A",
          url: "https://example.com/a",
        }),
      ),
      createWorkspaceMcpServerProfileResource(
        createHttpServer({
          id: "profile-2",
          name: "B",
          url: "https://example.com/b",
        }),
        defaultWorkspaceUserId,
        1,
      ),
    ];

    const result = deleteWorkspaceMcpServerProfile(currentProfiles, "profile-1");

    expect(result.deleted).toBe(true);
    expect(result.profiles).toHaveLength(1);
    expect(result.profiles[0]?.id).toBe("profile-2");
  });

  it("normalizes legacy filesystem defaults and merges missing defaults", () => {
    const legacyFilesystemProfile = createWorkspaceMcpServerProfileResource(
      {
        id: "legacy-filesystem",
        name: "filesystem",
        connectOnThreadCreate: false,
        transport: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem", "."],
        cwd: resolveLegacyFilesystemWorkingDirectory(),
        env: {},
      },
    );

    const mergedProfiles = mergeDefaultWorkspaceMcpServerProfiles(
      [legacyFilesystemProfile],
      {
        ...createPolicyDependencies(),
        workspaceUserId: defaultWorkspaceUserId,
      },
    );

    const filesystemProfile = mergedProfiles.find(
      (profile) => profile.name === "filesystem",
    );
    expect(filesystemProfile).toBeTruthy();
    const filesystemConfig = readMcpServerFromWorkspaceProfileResource(
      filesystemProfile!,
    );
    expect(filesystemConfig?.transport).toBe("stdio");
    if (filesystemConfig?.transport !== "stdio") {
      throw new Error("Expected stdio filesystem MCP server.");
    }
    expect(filesystemConfig.cwd).toBe(
      resolveDefaultFilesystemWorkingDirectory(defaultWorkspaceUserId),
    );
    expect(
      mergedProfiles.some((profile) => profile.name === "openai-docs"),
    ).toBe(true);
  });
});
