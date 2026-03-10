import { buildMcpServerConfigKey } from "~/lib/domain/value-objects/mcp-server-config-key";
import type {
  IncomingMcpServerConfig,
  McpServerConfig,
} from "~/lib/domain/value-objects/mcp-server-config";

type WorkspaceMcpServerProfileRecordLike = {
  id: string;
  userId: number;
  profileOrder: number;
  connectOnThreadCreate: boolean;
};

type WorkspaceMcpServerProfileFactoryInput =
  | (Extract<McpServerConfig, { transport: "stdio" }> & {
      userId: number;
      profileOrder: number;
    })
  | (Extract<McpServerConfig, { transport: "streamable_http" | "sse" }> & {
      userId: number;
      profileOrder: number;
    });

type WorkspaceMcpServerProfilePolicyDependencies<
  Profile extends WorkspaceMcpServerProfileRecordLike,
> = {
  readConfig(profile: Profile): McpServerConfig | null;
  createProfile(profile: WorkspaceMcpServerProfileFactoryInput): Profile;
  createId(): string;
};

export type DefaultWorkspaceMcpServerProfile =
  | {
      name: string;
      transport: "stdio";
      command: string;
      args: readonly string[];
      cwd: "default" | null;
      env: Record<string, string>;
      connectOnThreadCreate: boolean;
    }
  | {
      name: string;
      transport: "streamable_http" | "sse";
      url: string;
      headers: Record<string, string>;
      useAzureAuth: boolean;
      azureAuthScope: string;
      timeoutSeconds: number;
      connectOnThreadCreate: boolean;
    };

export function mergeDefaultWorkspaceMcpServerProfiles<
  Profile extends WorkspaceMcpServerProfileRecordLike,
>(
  currentProfiles: readonly Profile[],
  options: WorkspaceMcpServerProfilePolicyDependencies<Profile> & {
    workspaceUserId: number;
    defaultProfiles: readonly DefaultWorkspaceMcpServerProfile[];
    defaultFilesystemWorkingDirectory: string;
    legacyFilesystemWorkingDirectory: string;
    legacyUnavailableDefaultStdioNpxPackageNames: readonly string[];
  },
): Profile[] {
  const mergedProfiles = normalizeLegacyDefaultProfiles(currentProfiles, options);
  const profileKeys = new Set(
    mergedProfiles
      .map((profile) => options.readConfig(profile))
      .filter((profile): profile is McpServerConfig => profile !== null)
      .map((profile) => buildMcpServerConfigKey(profile)),
  );

  const nextProfiles = [...mergedProfiles];
  for (const profile of buildDefaultMcpServerProfiles(options)) {
    const config = options.readConfig(profile);
    if (!config) {
      continue;
    }

    const profileKey = buildMcpServerConfigKey(config);
    if (profileKeys.has(profileKey)) {
      continue;
    }

    profileKeys.add(profileKey);
    nextProfiles.push(profile);
  }

  return reindexProfiles(nextProfiles, options.workspaceUserId, options);
}

export function upsertWorkspaceMcpServerProfile<
  Profile extends WorkspaceMcpServerProfileRecordLike,
>(
  currentProfiles: readonly Profile[],
  options: WorkspaceMcpServerProfilePolicyDependencies<Profile> & {
    userId: number;
    incoming: IncomingMcpServerConfig;
  },
): {
  profile: Profile;
  profiles: Profile[];
  warning: string | null;
} {
  const incomingKey = buildMcpServerConfigKey(options.incoming);
  const currentConfigs = currentProfiles
    .map((profile) => ({
      profile,
      config: options.readConfig(profile),
    }))
    .filter(
      (entry): entry is { profile: Profile; config: McpServerConfig } =>
        entry.config !== null,
    );

  const keyIndex = currentConfigs.findIndex(
    ({ config }) => buildMcpServerConfigKey(config) === incomingKey,
  );
  const idIndex =
    options.incoming.id === undefined
      ? -1
      : currentProfiles.findIndex((profile) => profile.id === options.incoming.id);
  const index = keyIndex >= 0 ? keyIndex : idIndex;
  const previousProfile = index >= 0 ? currentProfiles[index] : null;
  const profileId =
    index >= 0
      ? currentProfiles[index].id
      : options.incoming.id &&
          !currentProfiles.some((profile) => profile.id === options.incoming.id)
        ? options.incoming.id
        : options.createId();
  const connectOnThreadCreate =
    options.incoming.connectOnThreadCreate ??
    previousProfile?.connectOnThreadCreate ??
    false;

  const profile = options.createProfile(
    options.incoming.transport === "stdio"
      ? {
          id: profileId,
          userId: options.userId,
          profileOrder:
            index >= 0 ? currentProfiles[index].profileOrder : currentProfiles.length,
          name: options.incoming.name,
          connectOnThreadCreate,
          transport: options.incoming.transport,
          command: options.incoming.command,
          args: options.incoming.args,
          cwd: options.incoming.cwd,
          env: options.incoming.env,
        }
      : {
          id: profileId,
          userId: options.userId,
          profileOrder:
            index >= 0 ? currentProfiles[index].profileOrder : currentProfiles.length,
          name: options.incoming.name,
          connectOnThreadCreate,
          transport: options.incoming.transport,
          url: options.incoming.url,
          headers: options.incoming.headers,
          useAzureAuth: options.incoming.useAzureAuth,
          azureAuthScope: options.incoming.azureAuthScope,
          timeoutSeconds: options.incoming.timeoutSeconds,
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
    const previousConfig = options.readConfig(previousProfile);
    const previousName = previousConfig?.name ?? options.incoming.name;
    warning =
      previousName === options.incoming.name
        ? "An MCP server with the same configuration already exists. Reused the existing saved profile."
        : `An MCP server with the same configuration already exists. Renamed it from "${previousName}" to "${options.incoming.name}".`;
  }

  return {
    profile,
    profiles: reindexProfiles(profiles, options.userId, options),
    warning,
  };
}

export function deleteWorkspaceMcpServerProfile<
  Profile extends WorkspaceMcpServerProfileRecordLike,
>(
  currentProfiles: readonly Profile[],
  id: string,
): { profiles: Profile[]; deleted: boolean } {
  const nextProfiles = currentProfiles.filter((profile) => profile.id !== id);
  return {
    profiles: nextProfiles,
    deleted: nextProfiles.length !== currentProfiles.length,
  };
}

function buildDefaultMcpServerProfiles<
  Profile extends WorkspaceMcpServerProfileRecordLike,
>(
  options: WorkspaceMcpServerProfilePolicyDependencies<Profile> & {
    workspaceUserId: number;
    defaultProfiles: readonly DefaultWorkspaceMcpServerProfile[];
    defaultFilesystemWorkingDirectory: string;
  },
): Profile[] {
  return options.defaultProfiles.map((defaultProfile, index) =>
    defaultProfile.transport === "stdio"
      ? options.createProfile({
          id: options.createId(),
          userId: options.workspaceUserId,
          profileOrder: index,
          connectOnThreadCreate: defaultProfile.connectOnThreadCreate,
          name: defaultProfile.name,
          transport: defaultProfile.transport,
          command: defaultProfile.command,
          args: [...defaultProfile.args],
          cwd:
            defaultProfile.cwd === "default"
              ? options.defaultFilesystemWorkingDirectory
              : undefined,
          env: { ...defaultProfile.env },
        })
      : options.createProfile({
          id: options.createId(),
          userId: options.workspaceUserId,
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

function normalizeLegacyDefaultProfiles<
  Profile extends WorkspaceMcpServerProfileRecordLike,
>(
  currentProfiles: readonly Profile[],
  options: WorkspaceMcpServerProfilePolicyDependencies<Profile> & {
    workspaceUserId: number;
    defaultProfiles: readonly DefaultWorkspaceMcpServerProfile[];
    defaultFilesystemWorkingDirectory: string;
    legacyFilesystemWorkingDirectory: string;
    legacyUnavailableDefaultStdioNpxPackageNames: readonly string[];
  },
): Profile[] {
  const normalizedProfiles: Profile[] = [];
  const defaultMermaidProfile = readNamedDefaultStdioProfile(
    options.defaultProfiles,
    "mcp-mermaid",
  );
  const defaultFilesystemProfile = readNamedDefaultStdioProfile(
    options.defaultProfiles,
    "filesystem",
  );
  const legacyUnavailablePackageNames = new Set(
    options.legacyUnavailableDefaultStdioNpxPackageNames,
  );

  for (const profile of currentProfiles) {
    const config = options.readConfig(profile);
    if (!config) {
      continue;
    }

    if (
      isLegacyUnavailableDefaultStdioProfile(config, legacyUnavailablePackageNames)
    ) {
      continue;
    }

    if (
      !isLegacyDefaultMermaidProfile(
        config,
        defaultMermaidProfile,
        options.legacyFilesystemWorkingDirectory,
      ) &&
      !isLegacyDefaultFilesystemProfile(
        config,
        defaultFilesystemProfile,
        options.legacyFilesystemWorkingDirectory,
      )
    ) {
      normalizedProfiles.push(profile);
      continue;
    }

    normalizedProfiles.push(
      config.transport === "stdio"
        ? options.createProfile({
            ...config,
            userId: profile.userId,
            profileOrder: profile.profileOrder,
            cwd: options.defaultFilesystemWorkingDirectory,
          })
        : profile,
    );
  }

  return normalizedProfiles;
}

function reindexProfiles<Profile extends WorkspaceMcpServerProfileRecordLike>(
  profiles: readonly Profile[],
  userId: number,
  options: WorkspaceMcpServerProfilePolicyDependencies<Profile>,
): Profile[] {
  return profiles.map((profile, index) => {
    const config = options.readConfig(profile);
    if (!config) {
      return {
        ...profile,
        userId,
        profileOrder: index,
      };
    }

    return options.createProfile({
      ...config,
      userId,
      profileOrder: index,
    });
  });
}

function readNamedDefaultStdioProfile(
  profiles: readonly DefaultWorkspaceMcpServerProfile[],
  name: string,
): Extract<DefaultWorkspaceMcpServerProfile, { transport: "stdio" }> | null {
  return (
    profiles.find(
      (
        profile,
      ): profile is Extract<
        DefaultWorkspaceMcpServerProfile,
        { transport: "stdio" }
      > => profile.transport === "stdio" && profile.name === name,
    ) ?? null
  );
}

function isLegacyDefaultMermaidProfile(
  profile: McpServerConfig,
  defaultProfile: Extract<DefaultWorkspaceMcpServerProfile, { transport: "stdio" }> | null,
  legacyDefaultWorkingDirectory: string,
): profile is Extract<McpServerConfig, { transport: "stdio" }> {
  if (profile.transport !== "stdio" || !defaultProfile) {
    return false;
  }

  return (
    profile.command === defaultProfile.command &&
    profile.args.length === defaultProfile.args.length &&
    profile.args.every((arg, index) => arg === defaultProfile.args[index]) &&
    Object.keys(profile.env).length === 0 &&
    isLegacyDefaultWorkingDirectory(profile.cwd, legacyDefaultWorkingDirectory)
  );
}

function isLegacyDefaultFilesystemProfile(
  profile: McpServerConfig,
  defaultProfile: Extract<DefaultWorkspaceMcpServerProfile, { transport: "stdio" }> | null,
  legacyDefaultWorkingDirectory: string,
): profile is Extract<McpServerConfig, { transport: "stdio" }> {
  if (profile.transport !== "stdio" || !defaultProfile) {
    return false;
  }

  return (
    profile.command === defaultProfile.command &&
    profile.args.length === defaultProfile.args.length &&
    profile.args.every((arg, index) => arg === defaultProfile.args[index]) &&
    Object.keys(profile.env).length === 0 &&
    isLegacyDefaultWorkingDirectory(profile.cwd, legacyDefaultWorkingDirectory)
  );
}

function isLegacyUnavailableDefaultStdioProfile(
  profile: McpServerConfig,
  legacyUnavailablePackageNames: ReadonlySet<string>,
): boolean {
  if (profile.transport !== "stdio") {
    return false;
  }

  return (
    profile.command === "npx" &&
    profile.args.length === 2 &&
    profile.args[0] === "-y" &&
    legacyUnavailablePackageNames.has(profile.args[1]) &&
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
