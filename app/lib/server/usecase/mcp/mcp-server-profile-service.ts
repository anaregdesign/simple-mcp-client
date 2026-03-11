/**
 * MCP server profile application service module.
 */
import {
  DEFAULT_WORKSPACE_MCP_SERVER_PROFILE_ROWS,
  MCP_LEGACY_UNAVAILABLE_DEFAULT_STDIO_NPX_PACKAGE_NAMES,
} from "~/lib/constants/mcp";
import {
  readMcpServerFromWorkspaceProfileResource,
  type McpServerConfig,
} from "~/lib/contracts/mcp/profile";
import {
  type ParsedIncomingMcpServerConfig,
} from "~/lib/contracts/mcp/server-config-parser";
import {
  deleteWorkspaceMcpServerProfile as deleteWorkspaceMcpServerProfilePolicy,
  mergeDefaultWorkspaceMcpServerProfiles as mergeDefaultWorkspaceMcpServerProfilesPolicy,
  upsertWorkspaceMcpServerProfile as upsertWorkspaceMcpServerProfilePolicy,
  type DefaultWorkspaceMcpServerProfile,
} from "~/lib/domain/services/workspace-mcp-server-profile-policy";
import { buildMcpServerConfigKey } from "~/lib/domain/value-objects/mcp-server-config-key";
import type {
  WorkspaceMcpServerProfile,
  WorkspaceMcpServerProfileRepository,
} from "~/lib/domain/repositories/workspace-mcp-server-profile-repository";

export type IncomingMcpServerConfig = ParsedIncomingMcpServerConfig;
export type McpServerProfilePathResolver = {
  resolveDefaultFilesystemWorkingDirectory(workspaceUserId: number): string;
  resolveLegacyFilesystemWorkingDirectory(): string;
};
const defaultWorkspaceMcpServerProfiles =
  DEFAULT_WORKSPACE_MCP_SERVER_PROFILE_ROWS as readonly DefaultWorkspaceMcpServerProfile[];

export class McpServerProfileService {
  constructor(
    private readonly repository: WorkspaceMcpServerProfileRepository,
    private readonly pathResolver: McpServerProfilePathResolver,
  ) {}

  async readWorkspaceMcpServerProfiles(
    userId: number,
  ): Promise<WorkspaceMcpServerProfile[]> {
    return readWorkspaceMcpServerProfiles(this.repository, userId);
  }

  async writeWorkspaceMcpServerProfiles(
    userId: number,
    profiles: WorkspaceMcpServerProfile[],
  ): Promise<void> {
    return writeWorkspaceMcpServerProfiles(this.repository, userId, profiles);
  }

  async ensureDefaultMcpServersForUser(userId: number): Promise<void> {
    return ensureDefaultMcpServersForUser(
      this.repository,
      userId,
      this.pathResolver,
    );
  }

  mergeDefaultWorkspaceMcpServerProfiles(
    currentProfiles: WorkspaceMcpServerProfile[],
    workspaceUserId: number,
  ): WorkspaceMcpServerProfile[] {
    return mergeDefaultWorkspaceMcpServerProfilesPolicy(currentProfiles, {
      ...createWorkspaceMcpServerProfilePolicyDependencies(),
      workspaceUserId,
      defaultProfiles: defaultWorkspaceMcpServerProfiles,
      defaultFilesystemWorkingDirectory:
        this.pathResolver.resolveDefaultFilesystemWorkingDirectory(
          workspaceUserId,
        ),
      legacyFilesystemWorkingDirectory:
        this.pathResolver.resolveLegacyFilesystemWorkingDirectory(),
      legacyUnavailableDefaultStdioNpxPackageNames:
        MCP_LEGACY_UNAVAILABLE_DEFAULT_STDIO_NPX_PACKAGE_NAMES,
    });
  }

  upsertWorkspaceMcpServerProfile(
    userId: number,
    currentProfiles: WorkspaceMcpServerProfile[],
    incoming: IncomingMcpServerConfig,
  ): {
    profile: WorkspaceMcpServerProfile;
    profiles: WorkspaceMcpServerProfile[];
    warning: string | null;
  } {
    return upsertWorkspaceMcpServerProfilePolicy(currentProfiles, {
      ...createWorkspaceMcpServerProfilePolicyDependencies(),
      userId,
      incoming,
    });
  }

  deleteWorkspaceMcpServerProfile(
    currentProfiles: WorkspaceMcpServerProfile[],
    id: string,
  ): { profiles: WorkspaceMcpServerProfile[]; deleted: boolean } {
    return deleteWorkspaceMcpServerProfilePolicy(currentProfiles, id);
  }
}

export function createMcpServerProfileService(
  repository: WorkspaceMcpServerProfileRepository,
  pathResolver: McpServerProfilePathResolver,
): McpServerProfileService {
  return new McpServerProfileService(repository, pathResolver);
}

export async function readWorkspaceMcpServerProfiles(
  repository: WorkspaceMcpServerProfileRepository,
  userId: number,
): Promise<WorkspaceMcpServerProfile[]> {
  const records = await repository.listByUserId(userId);

  const profiles: WorkspaceMcpServerProfile[] = [];
  const keys = new Set<string>();

  for (const record of records) {
    const config = readMcpServerFromWorkspaceProfileResource(record);
    if (!config) {
      continue;
    }

    const key = buildMcpServerConfigKey(config);
    if (keys.has(key)) {
      continue;
    }

    keys.add(key);
    profiles.push(record);
  }

  return profiles;
}

export async function writeWorkspaceMcpServerProfiles(
  repository: WorkspaceMcpServerProfileRepository,
  userId: number,
  profiles: WorkspaceMcpServerProfile[],
): Promise<void> {
  await repository.replaceByUserId(
    userId,
    profiles.map((profile, index) =>
      mapProfileToDatabaseRecord(userId, profile, index),
    ),
  );
}

export function mergeDefaultWorkspaceMcpServerProfiles(
  currentProfiles: WorkspaceMcpServerProfile[],
  workspaceUserId: number,
  pathResolver: McpServerProfilePathResolver,
): WorkspaceMcpServerProfile[] {
  return mergeDefaultWorkspaceMcpServerProfilesPolicy(currentProfiles, {
    ...createWorkspaceMcpServerProfilePolicyDependencies(),
    workspaceUserId,
    defaultProfiles: defaultWorkspaceMcpServerProfiles,
    defaultFilesystemWorkingDirectory:
      pathResolver.resolveDefaultFilesystemWorkingDirectory(workspaceUserId),
    legacyFilesystemWorkingDirectory:
      pathResolver.resolveLegacyFilesystemWorkingDirectory(),
    legacyUnavailableDefaultStdioNpxPackageNames:
      MCP_LEGACY_UNAVAILABLE_DEFAULT_STDIO_NPX_PACKAGE_NAMES,
  });
}

export function upsertWorkspaceMcpServerProfile(
  userId: number,
  currentProfiles: WorkspaceMcpServerProfile[],
  incoming: IncomingMcpServerConfig,
): {
  profile: WorkspaceMcpServerProfile;
  profiles: WorkspaceMcpServerProfile[];
  warning: string | null;
} {
  return upsertWorkspaceMcpServerProfilePolicy(currentProfiles, {
    ...createWorkspaceMcpServerProfilePolicyDependencies(),
    userId,
    incoming,
  });
}

export function deleteWorkspaceMcpServerProfile(
  currentProfiles: WorkspaceMcpServerProfile[],
  id: string,
): { profiles: WorkspaceMcpServerProfile[]; deleted: boolean } {
  return deleteWorkspaceMcpServerProfilePolicy(currentProfiles, id);
}

export async function ensureDefaultMcpServersForUser(
  repository: WorkspaceMcpServerProfileRepository,
  userId: number,
  pathResolver: McpServerProfilePathResolver,
): Promise<void> {
  const currentProfiles = await readWorkspaceMcpServerProfiles(
    repository,
    userId,
  );
  const nextProfiles = mergeDefaultWorkspaceMcpServerProfilesPolicy(
    currentProfiles,
    {
      ...createWorkspaceMcpServerProfilePolicyDependencies(),
      workspaceUserId: userId,
      defaultProfiles: defaultWorkspaceMcpServerProfiles,
      defaultFilesystemWorkingDirectory:
        pathResolver.resolveDefaultFilesystemWorkingDirectory(userId),
      legacyFilesystemWorkingDirectory:
        pathResolver.resolveLegacyFilesystemWorkingDirectory(),
      legacyUnavailableDefaultStdioNpxPackageNames:
        MCP_LEGACY_UNAVAILABLE_DEFAULT_STDIO_NPX_PACKAGE_NAMES,
    },
  );
  if (nextProfiles.length === currentProfiles.length) {
    return;
  }

  await writeWorkspaceMcpServerProfiles(repository, userId, nextProfiles);
}

function createWorkspaceMcpServerProfilePolicyDependencies() {
  return {
    readConfig: readMcpServerFromWorkspaceProfileResource,
    createProfile: createWorkspaceMcpServerProfile,
    createId: createRandomId,
  };
}

function mapProfileToDatabaseRecord(
  userId: number,
  profile: WorkspaceMcpServerProfile,
  profileOrder: number,
): WorkspaceMcpServerProfile {
  const config = readMcpServerFromWorkspaceProfileResource(profile);
  if (!config) {
    return {
      ...profile,
      userId,
      profileOrder,
    };
  }

  return createWorkspaceMcpServerProfile({
    ...config,
    userId,
    profileOrder,
  });
}

function createWorkspaceMcpServerProfile(
  profile:
    | (Extract<McpServerConfig, { transport: "stdio" }> & {
        userId: number;
        profileOrder: number;
      })
    | (Extract<McpServerConfig, { transport: "streamable_http" | "sse" }> & {
        userId: number;
        profileOrder: number;
      }),
): WorkspaceMcpServerProfile {
  const configKey = buildMcpServerConfigKey(profile);
  if (profile.transport === "stdio") {
    return {
      id: profile.id,
      userId: profile.userId,
      profileOrder: profile.profileOrder,
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
    userId: profile.userId,
    profileOrder: profile.profileOrder,
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

export function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error.";
}

function createRandomId(): string {
  const maybeCrypto = globalThis.crypto;
  if (maybeCrypto && typeof maybeCrypto.randomUUID === "function") {
    return maybeCrypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
