/**
 * MCP server profile application service module.
 */
import {
  DEFAULT_WORKSPACE_MCP_SERVER_PROFILE_ROWS,
  MCP_DEFAULT_AZURE_AUTH_SCOPE,
  MCP_DEFAULT_TIMEOUT_SECONDS,
  MCP_LEGACY_UNAVAILABLE_DEFAULT_STDIO_NPX_PACKAGE_NAMES,
} from "~/lib/constants/mcp";
import {
  buildMcpServerKey,
  readMcpServerFromWorkspaceProfileResource,
  type McpServerConfig,
} from "~/lib/contracts/mcp/profile";
import {
  type ParsedIncomingMcpServerConfig,
} from "~/lib/contracts/mcp/server-config-parser";
import type { WorkspaceMcpServerProfileResource as WorkspaceMcpServerProfile } from "~/lib/contracts/mcp/profile";
import type { WorkspaceMcpServerProfileRepository } from "~/lib/domain/repositories/workspace-mcp-server-profile-repository";

export type IncomingMcpServerConfig = ParsedIncomingMcpServerConfig;
export type McpServerProfilePathResolver = {
  resolveDefaultFilesystemWorkingDirectory(workspaceUserId: number): string;
  resolveLegacyFilesystemWorkingDirectory(): string;
};

const legacyUnavailableDefaultStdioNpxPackageNameSet = new Set<string>(
  MCP_LEGACY_UNAVAILABLE_DEFAULT_STDIO_NPX_PACKAGE_NAMES,
);

type DefaultWorkspaceMcpServerProfileRow =
  (typeof DEFAULT_WORKSPACE_MCP_SERVER_PROFILE_ROWS)[number];
type DefaultWorkspaceMcpServerProfileStdioRow = Extract<
  DefaultWorkspaceMcpServerProfileRow,
  { transport: "stdio" }
>;

const defaultMermaidWorkspaceMcpServerProfile =
  DEFAULT_WORKSPACE_MCP_SERVER_PROFILE_ROWS.find(
    (profile): profile is DefaultWorkspaceMcpServerProfileStdioRow =>
      profile.transport === "stdio" && profile.name === "mcp-mermaid",
  ) ?? null;

const defaultFilesystemWorkspaceMcpServerProfile =
  DEFAULT_WORKSPACE_MCP_SERVER_PROFILE_ROWS.find(
    (profile): profile is DefaultWorkspaceMcpServerProfileStdioRow =>
      profile.transport === "stdio" && profile.name === "filesystem",
  ) ?? null;

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
    return mergeDefaultWorkspaceMcpServerProfiles(
      currentProfiles,
      workspaceUserId,
      this.pathResolver,
    );
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
    return upsertWorkspaceMcpServerProfile(userId, currentProfiles, incoming);
  }

  deleteWorkspaceMcpServerProfile(
    currentProfiles: WorkspaceMcpServerProfile[],
    id: string,
  ): { profiles: WorkspaceMcpServerProfile[]; deleted: boolean } {
    return deleteWorkspaceMcpServerProfile(currentProfiles, id);
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

    const key = buildMcpServerKey(config);
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
  const mergedProfiles = normalizeLegacyDefaultProfiles(
    currentProfiles,
    workspaceUserId,
    pathResolver,
  );
  const profileKeys = new Set(
    mergedProfiles
      .map((profile) => readMcpServerFromWorkspaceProfileResource(profile))
      .filter((profile): profile is McpServerConfig => profile !== null)
      .map((profile) => buildMcpServerKey(profile)),
  );

  const nextProfiles = [...mergedProfiles];
  for (
    const profile of buildDefaultMcpServerProfiles(
      workspaceUserId,
      pathResolver,
    )
  ) {
    const config = readMcpServerFromWorkspaceProfileResource(profile);
    if (!config) {
      continue;
    }

    const profileKey = buildMcpServerKey(config);
    if (profileKeys.has(profileKey)) {
      continue;
    }

    profileKeys.add(profileKey);
    nextProfiles.push(profile);
  }

  return nextProfiles.map((profile, index) =>
    mapProfileToDatabaseRecord(workspaceUserId, profile, index),
  );
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
  const nextProfiles = mergeDefaultWorkspaceMcpServerProfiles(
    currentProfiles,
    userId,
    pathResolver,
  );
  if (nextProfiles.length === currentProfiles.length) {
    return;
  }

  await writeWorkspaceMcpServerProfiles(repository, userId, nextProfiles);
}

function buildDefaultMcpServerProfiles(
  workspaceUserId: number,
  pathResolver: McpServerProfilePathResolver,
): WorkspaceMcpServerProfile[] {
  const defaultStdioWorkingDirectory =
    pathResolver.resolveDefaultFilesystemWorkingDirectory(workspaceUserId);
  return DEFAULT_WORKSPACE_MCP_SERVER_PROFILE_ROWS.map((defaultProfile, index) =>
    defaultProfile.transport === "stdio"
      ? createWorkspaceMcpServerProfile({
          id: createRandomId(),
          userId: workspaceUserId,
          profileOrder: index,
          connectOnThreadCreate: defaultProfile.connectOnThreadCreate,
          name: defaultProfile.name,
          transport: defaultProfile.transport,
          command: defaultProfile.command,
          args: [...defaultProfile.args],
          cwd:
            defaultProfile.cwd === "default"
              ? defaultStdioWorkingDirectory
              : undefined,
          env: { ...defaultProfile.env },
        })
      : createWorkspaceMcpServerProfile({
          id: createRandomId(),
          userId: workspaceUserId,
          profileOrder: index,
          connectOnThreadCreate: defaultProfile.connectOnThreadCreate,
          name: defaultProfile.name,
          transport: defaultProfile.transport,
          url: defaultProfile.url,
          headers: { ...defaultProfile.headers },
          useAzureAuth: defaultProfile.useAzureAuth,
          azureAuthScope: defaultProfile.azureAuthScope,
          timeoutSeconds: defaultProfile.timeoutSeconds,
        }),
  );
}

function normalizeLegacyDefaultProfiles(
  currentProfiles: WorkspaceMcpServerProfile[],
  workspaceUserId: number,
  pathResolver: McpServerProfilePathResolver,
): WorkspaceMcpServerProfile[] {
  const defaultWorkingDirectory =
    pathResolver.resolveDefaultFilesystemWorkingDirectory(workspaceUserId);
  const legacyDefaultWorkingDirectory =
    pathResolver.resolveLegacyFilesystemWorkingDirectory();
  const normalizedProfiles: WorkspaceMcpServerProfile[] = [];

  for (const profile of currentProfiles) {
    const config = readMcpServerFromWorkspaceProfileResource(profile);
    if (!config) {
      continue;
    }

    if (isLegacyUnavailableDefaultStdioProfile(config)) {
      continue;
    }

    if (
      !isLegacyDefaultMermaidProfile(config, legacyDefaultWorkingDirectory) &&
      !isLegacyDefaultFilesystemProfile(config, legacyDefaultWorkingDirectory)
    ) {
      normalizedProfiles.push(profile);
      continue;
    }

    normalizedProfiles.push(
      config.transport === "stdio"
        ? createWorkspaceMcpServerProfile({
            ...config,
            userId: profile.userId,
            profileOrder: profile.profileOrder,
            cwd: defaultWorkingDirectory,
          })
        : profile,
    );
  }

  return normalizedProfiles;
}

function isLegacyDefaultMermaidProfile(
  profile: McpServerConfig,
  legacyDefaultWorkingDirectory: string,
): profile is Extract<McpServerConfig, { transport: "stdio" }> {
  if (profile.transport !== "stdio" || !defaultMermaidWorkspaceMcpServerProfile) {
    return false;
  }

  return (
    profile.command === defaultMermaidWorkspaceMcpServerProfile.command &&
    profile.args.length === defaultMermaidWorkspaceMcpServerProfile.args.length &&
    profile.args.every(
      (arg, index) => arg === defaultMermaidWorkspaceMcpServerProfile.args[index],
    ) &&
    Object.keys(profile.env).length === 0 &&
    isLegacyDefaultWorkingDirectory(profile.cwd, legacyDefaultWorkingDirectory)
  );
}

function isLegacyDefaultFilesystemProfile(
  profile: McpServerConfig,
  legacyDefaultWorkingDirectory: string,
): profile is Extract<McpServerConfig, { transport: "stdio" }> {
  if (
    profile.transport !== "stdio" ||
    !defaultFilesystemWorkspaceMcpServerProfile
  ) {
    return false;
  }

  return (
    profile.command === defaultFilesystemWorkspaceMcpServerProfile.command &&
    profile.args.length === defaultFilesystemWorkspaceMcpServerProfile.args.length &&
    profile.args.every(
      (arg, index) => arg === defaultFilesystemWorkspaceMcpServerProfile.args[index],
    ) &&
    Object.keys(profile.env).length === 0 &&
    isLegacyDefaultWorkingDirectory(profile.cwd, legacyDefaultWorkingDirectory)
  );
}

function isLegacyUnavailableDefaultStdioProfile(profile: McpServerConfig): boolean {
  if (profile.transport !== "stdio") {
    return false;
  }

  return (
    profile.command === "npx" &&
    profile.args.length === 2 &&
    profile.args[0] === "-y" &&
    legacyUnavailableDefaultStdioNpxPackageNameSet.has(profile.args[1]) &&
    !profile.cwd &&
    Object.keys(profile.env).length === 0
  );
}

function isLegacyDefaultWorkingDirectory(
  cwd: string | undefined,
  legacyDefaultWorkingDirectory: string,
): boolean {
  if (!cwd) {
    return true;
  }

  return (
    normalizePathForComparison(cwd) ===
    normalizePathForComparison(legacyDefaultWorkingDirectory)
  );
}

function normalizePathForComparison(value: string): string {
  return value.trim().replaceAll("\\", "/").toLowerCase();
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
  const incomingKey = buildIncomingProfileKey(incoming);
  const currentConfigs = currentProfiles
    .map((profile) => ({
      profile,
      config: readMcpServerFromWorkspaceProfileResource(profile),
    }))
    .filter(
      (entry): entry is { profile: WorkspaceMcpServerProfile; config: McpServerConfig } =>
        entry.config !== null,
    );

  const keyIndex = currentConfigs.findIndex(
    ({ config }) => buildMcpServerKey(config) === incomingKey,
  );

  const idIndex =
    incoming.id === undefined
      ? -1
      : currentProfiles.findIndex((profile) => profile.id === incoming.id);

  const index = keyIndex >= 0 ? keyIndex : idIndex;
  const previousProfile = index >= 0 ? currentProfiles[index] : null;
  const profileId =
    index >= 0
      ? currentProfiles[index].id
      : incoming.id && !currentProfiles.some((profile) => profile.id === incoming.id)
        ? incoming.id
        : createRandomId();
  const connectOnThreadCreate =
    incoming.connectOnThreadCreate ??
    previousProfile?.connectOnThreadCreate ??
    false;

  const profile = createWorkspaceMcpServerProfile(
    incoming.transport === "stdio"
      ? {
          id: profileId,
          userId,
          profileOrder: index >= 0 ? currentProfiles[index].profileOrder : currentProfiles.length,
          name: incoming.name,
          connectOnThreadCreate,
          transport: incoming.transport,
          command: incoming.command,
          args: incoming.args,
          cwd: incoming.cwd,
          env: incoming.env,
        }
      : {
          id: profileId,
          userId,
          profileOrder: index >= 0 ? currentProfiles[index].profileOrder : currentProfiles.length,
          name: incoming.name,
          connectOnThreadCreate,
          transport: incoming.transport,
          url: incoming.url,
          headers: incoming.headers,
          useAzureAuth: incoming.useAzureAuth,
          azureAuthScope: incoming.azureAuthScope,
          timeoutSeconds: incoming.timeoutSeconds,
        },
  );

  const profiles =
    index >= 0
      ? currentProfiles.map((entry, entryIndex) =>
          entryIndex === index ? profile : entry,
        )
      : [...currentProfiles, profile];

  let warning: string | null = null;
  if (keyIndex >= 0 && previousProfile) {
    warning =
      previousProfile.name === incoming.name
        ? "An MCP server with the same configuration already exists. Reused the existing saved profile."
        : `An MCP server with the same configuration already exists. Renamed it from "${previousProfile.name}" to "${incoming.name}".`;
  }

  return {
    profile,
    profiles: profiles.map((entry, entryIndex) =>
      mapProfileToDatabaseRecord(userId, entry, entryIndex),
    ),
    warning,
  };
}

export function deleteWorkspaceMcpServerProfile(
  currentProfiles: WorkspaceMcpServerProfile[],
  id: string,
): { profiles: WorkspaceMcpServerProfile[]; deleted: boolean } {
  const nextProfiles = currentProfiles.filter((profile) => profile.id !== id);
  return {
    profiles: nextProfiles,
    deleted: nextProfiles.length !== currentProfiles.length,
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
  const configKey = buildMcpServerKey(profile);
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

function buildIncomingProfileKey(profile: IncomingMcpServerConfig): string {
  return buildMcpServerKey(
    profile.transport === "stdio"
      ? {
          id: profile.id ?? "",
          name: profile.name,
          connectOnThreadCreate: profile.connectOnThreadCreate,
          transport: profile.transport,
          command: profile.command,
          args: profile.args,
          cwd: profile.cwd,
          env: profile.env,
        }
      : {
          id: profile.id ?? "",
          name: profile.name,
          connectOnThreadCreate: profile.connectOnThreadCreate,
          transport: profile.transport,
          url: profile.url,
          headers: profile.headers,
          useAzureAuth: profile.useAzureAuth,
          azureAuthScope: profile.azureAuthScope,
          timeoutSeconds: profile.timeoutSeconds,
        },
  );
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
