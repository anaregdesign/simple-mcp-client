/**
 * API route module for /api/mcp/servers.
 */
import { HOME_DEFAULT_WORKSPACE_MCP_SERVER_PROFILE_ROWS, MCP_DEFAULT_AZURE_AUTH_SCOPE, MCP_DEFAULT_TIMEOUT_SECONDS, MCP_LEGACY_UNAVAILABLE_DEFAULT_STDIO_NPX_PACKAGE_NAMES } from "~/lib/constants/mcp";
import { buildMcpServerConfigKey } from "~/lib/mcp/config-key";
import {
  parseIncomingMcpServer,
  readTransport,
  type McpTransport,
  type ParsedIncomingMcpServerConfig,
} from "~/lib/mcp/server-config-parser";
import {
  resolveFoundryConfigDirectory,
  resolveFoundryWorkspaceUserDirectory,
} from "~/lib/foundry/config";
import {
  ensurePersistenceDatabaseReady,
  prisma,
} from "~/lib/server/persistence/prisma";
import { getOrCreateUserByIdentity } from "~/lib/server/persistence/user";
import { readAzureArmUserContext } from "~/lib/server/auth/azure-user";
import {
  authRequiredResponse,
  errorResponse,
  invalidJsonResponse,
  methodNotAllowedResponse,
  validationErrorResponse,
} from "~/lib/server/http";
import {
  installGlobalServerErrorLogging,
  logServerRouteEvent,
} from "~/lib/server/observability/runtime-event-log";
import type { Route } from "./+types/api.mcp.servers";

export { parseIncomingMcpServer };

type WorkspaceMcpServerProfileHttpConfig = {
  id: string;
  name: string;
  connectOnThreadCreate: boolean;
  transport: "streamable_http" | "sse";
  url: string;
  headers: Record<string, string>;
  useAzureAuth: boolean;
  azureAuthScope: string;
  timeoutSeconds: number;
};

type WorkspaceMcpServerProfileStdioConfig = {
  id: string;
  name: string;
  connectOnThreadCreate: boolean;
  transport: "stdio";
  command: string;
  args: string[];
  cwd?: string;
  env: Record<string, string>;
};

export type WorkspaceMcpServerProfileConfig = WorkspaceMcpServerProfileHttpConfig | WorkspaceMcpServerProfileStdioConfig;
export type IncomingMcpServerConfig = ParsedIncomingMcpServerConfig;
const legacyUnavailableDefaultStdioNpxPackageNameSet = new Set<string>(
  MCP_LEGACY_UNAVAILABLE_DEFAULT_STDIO_NPX_PACKAGE_NAMES,
);
type HomeDefaultWorkspaceMcpServerProfileRow =
  (typeof HOME_DEFAULT_WORKSPACE_MCP_SERVER_PROFILE_ROWS)[number];
type HomeDefaultWorkspaceMcpServerProfileStdioRow = Extract<
  HomeDefaultWorkspaceMcpServerProfileRow,
  { transport: "stdio" }
>;
const defaultMermaidWorkspaceMcpServerProfile =
  HOME_DEFAULT_WORKSPACE_MCP_SERVER_PROFILE_ROWS.find(
    (profile): profile is HomeDefaultWorkspaceMcpServerProfileStdioRow =>
      profile.transport === "stdio" && profile.name === "mcp-mermaid",
  ) ?? null;
const defaultFilesystemWorkspaceMcpServerProfile =
  HOME_DEFAULT_WORKSPACE_MCP_SERVER_PROFILE_ROWS.find(
    (profile): profile is HomeDefaultWorkspaceMcpServerProfileStdioRow =>
      profile.transport === "stdio" && profile.name === "filesystem",
  ) ?? null;
const MCP_SERVERS_COLLECTION_ALLOWED_METHODS = ["GET", "POST"] as const;

export async function loader({ request }: Route.LoaderArgs) {
  installGlobalServerErrorLogging();

  if (request.method !== "GET") {
    return methodNotAllowedResponse(MCP_SERVERS_COLLECTION_ALLOWED_METHODS);
  }

  const user = await readAuthenticatedUser();
  if (!user) {
    return authRequiredResponse();
  }

  try {
    await ensureDefaultMcpServersForUser(user.id);
    const profiles = await readWorkspaceMcpServerProfiles(user.id);
    return Response.json({ profiles });
  } catch (error) {
    await logServerRouteEvent({
      request,
      route: "/api/mcp/servers",
      eventName: "read_mcp_servers_failed",
      action: "read_saved_profiles",
      statusCode: 500,
      error,
      userId: user.id,
    });

    return errorResponse({
      status: 500,
      code: "read_mcp_servers_failed",
      error: `Failed to read MCP servers from database: ${readErrorMessage(error)}`,
    });
  }
}

export async function action({ request }: Route.ActionArgs) {
  installGlobalServerErrorLogging();

  if (request.method !== "POST") {
    return methodNotAllowedResponse(MCP_SERVERS_COLLECTION_ALLOWED_METHODS);
  }

  const user = await readAuthenticatedUser();
  if (!user) {
    return authRequiredResponse();
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    await logServerRouteEvent({
      request,
      route: "/api/mcp/servers",
      eventName: "invalid_json_body",
      action: "parse_request_body",
      level: "warning",
      statusCode: 400,
      message: "Invalid JSON body.",
      userId: user.id,
    });

    return invalidJsonResponse();
  }

  if (isRecord(payload) && payload.id !== undefined) {
    await logServerRouteEvent({
      request,
      route: "/api/mcp/servers",
      eventName: "invalid_mcp_server_payload",
      action: "validate_payload",
      level: "warning",
      statusCode: 422,
      message: "`id` must not be provided for POST.",
      userId: user.id,
    });
    return validationErrorResponse(
      "invalid_mcp_server_payload",
      "`id` must not be provided for POST.",
    );
  }

  const incomingResult = parseIncomingMcpServer(payload);
  if (!incomingResult.ok) {
    await logServerRouteEvent({
      request,
      route: "/api/mcp/servers",
      eventName: "invalid_mcp_server_payload",
      action: "validate_payload",
      level: "warning",
      statusCode: 422,
      message: incomingResult.error,
      userId: user.id,
    });

    return validationErrorResponse("invalid_mcp_server_payload", incomingResult.error);
  }
  const incomingMcpServer = incomingResult.value;

  try {
    const currentProfiles = await readWorkspaceMcpServerProfiles(user.id);
    const profilesWithDefaults = mergeDefaultWorkspaceMcpServerProfiles(currentProfiles, user.id);
    const existingIds = new Set(profilesWithDefaults.map((profile) => profile.id));
    const { profile, profiles, warning } = upsertWorkspaceMcpServerProfile(
      profilesWithDefaults,
      incomingMcpServer,
    );
    await writeWorkspaceMcpServerProfiles(user.id, profiles);
    const created = !existingIds.has(profile.id);
    const status = created ? 201 : 200;

    if (warning) {
      await logServerRouteEvent({
        request,
        route: "/api/mcp/servers",
        eventName: "mcp_server_duplicate_reused",
        action: "upsert_saved_profile",
        level: "warning",
        statusCode: status,
        message: warning,
        userId: user.id,
        context: {
          profileId: profile.id,
          transport: profile.transport,
        },
      });
    }

    return Response.json(
      { profile, profiles, warning },
      {
        status,
        headers: created
          ? {
              Location: `/api/mcp/servers/${encodeURIComponent(profile.id)}`,
            }
          : undefined,
      },
    );
  } catch (error) {
    await logServerRouteEvent({
      request,
      route: "/api/mcp/servers",
      eventName: "save_mcp_servers_failed",
      action: "write_saved_profiles",
      statusCode: 500,
      error,
      userId: user.id,
    });

    return errorResponse({
      status: 500,
      code: "save_mcp_servers_failed",
      error: `Failed to update MCP servers in database: ${readErrorMessage(error)}`,
    });
  }
}

export async function readWorkspaceMcpServerProfiles(userId: number): Promise<WorkspaceMcpServerProfileConfig[]> {
  await ensurePersistenceDatabaseReady();
  const records = await prisma.workspaceMcpServerProfile.findMany({
    where: {
      userId,
    },
    orderBy: {
      profileOrder: "asc",
    },
  });

  const profiles: WorkspaceMcpServerProfileConfig[] = [];
  const keys = new Set<string>();

  for (const record of records) {
    const normalized = normalizeStoredMcpServerRecord(record);
    if (!normalized) {
      continue;
    }

    const key = buildProfileKey(normalized);
    if (keys.has(key)) {
      continue;
    }

    keys.add(key);
    profiles.push(normalized);
  }

  return profiles;
}

export async function writeWorkspaceMcpServerProfiles(
  userId: number,
  profiles: WorkspaceMcpServerProfileConfig[],
): Promise<void> {
  await ensurePersistenceDatabaseReady();
  await prisma.$transaction(async (transaction) => {
    await transaction.workspaceMcpServerProfile.deleteMany({
      where: { userId },
    });
    if (profiles.length === 0) {
      return;
    }

    await transaction.workspaceMcpServerProfile.createMany({
      data: profiles.map((profile, index) => mapProfileToDatabaseRecord(userId, profile, index)),
    });
  });
}

export function mergeDefaultWorkspaceMcpServerProfiles(
  currentProfiles: WorkspaceMcpServerProfileConfig[],
  workspaceUserId: number,
): WorkspaceMcpServerProfileConfig[] {
  const mergedProfiles = normalizeLegacyDefaultProfiles(currentProfiles, workspaceUserId);
  const profileKeys = new Set(mergedProfiles.map((profile) => buildProfileKey(profile)));
  for (const profile of buildDefaultMcpServerProfiles(workspaceUserId)) {
    const profileKey = buildProfileKey(profile);
    if (profileKeys.has(profileKey)) {
      continue;
    }

    profileKeys.add(profileKey);
    mergedProfiles.push(profile);
  }

  return mergedProfiles;
}

export async function ensureDefaultMcpServersForUser(userId: number): Promise<void> {
  const currentProfiles = await readWorkspaceMcpServerProfiles(userId);
  const nextProfiles = mergeDefaultWorkspaceMcpServerProfiles(currentProfiles, userId);
  if (nextProfiles.length === currentProfiles.length) {
    return;
  }

  await writeWorkspaceMcpServerProfiles(userId, nextProfiles);
}

function buildDefaultMcpServerProfiles(
  workspaceUserId: number,
): WorkspaceMcpServerProfileConfig[] {
  const defaultStdioWorkingDirectory = resolveDefaultFilesystemWorkingDirectory(workspaceUserId);
  return HOME_DEFAULT_WORKSPACE_MCP_SERVER_PROFILE_ROWS.map((defaultProfile) => {
    if (defaultProfile.transport === "stdio") {
      return {
        id: createRandomId(),
        name: defaultProfile.name,
        connectOnThreadCreate: defaultProfile.connectOnThreadCreate,
        transport: "stdio",
        command: defaultProfile.command,
        args: [...defaultProfile.args],
        cwd:
          defaultProfile.cwd === "default" ? defaultStdioWorkingDirectory : undefined,
        env: { ...defaultProfile.env },
      };
    }

    return {
      id: createRandomId(),
      name: defaultProfile.name,
      connectOnThreadCreate: defaultProfile.connectOnThreadCreate,
      transport: defaultProfile.transport,
      url: defaultProfile.url,
      headers: { ...defaultProfile.headers },
      useAzureAuth: defaultProfile.useAzureAuth,
      azureAuthScope: defaultProfile.azureAuthScope,
      timeoutSeconds: defaultProfile.timeoutSeconds,
    };
  });
}

function normalizeLegacyDefaultProfiles(
  currentProfiles: WorkspaceMcpServerProfileConfig[],
  workspaceUserId: number,
): WorkspaceMcpServerProfileConfig[] {
  const defaultWorkingDirectory = resolveDefaultFilesystemWorkingDirectory(workspaceUserId);
  const legacyDefaultWorkingDirectory = resolveLegacyFilesystemWorkingDirectory();
  const normalizedProfiles: WorkspaceMcpServerProfileConfig[] = [];

  for (const profile of currentProfiles) {
    if (isLegacyUnavailableDefaultStdioProfile(profile)) {
      continue;
    }

    if (
      !isLegacyDefaultMermaidProfile(profile, legacyDefaultWorkingDirectory) &&
      !isLegacyDefaultFilesystemProfile(profile, legacyDefaultWorkingDirectory)
    ) {
      normalizedProfiles.push(profile);
      continue;
    }

    normalizedProfiles.push({
      ...profile,
      cwd: defaultWorkingDirectory,
    });
  }

  return normalizedProfiles;
}

function isLegacyDefaultMermaidProfile(
  profile: WorkspaceMcpServerProfileConfig,
  legacyDefaultWorkingDirectory: string,
): profile is WorkspaceMcpServerProfileStdioConfig {
  if (profile.transport !== "stdio" || !defaultMermaidWorkspaceMcpServerProfile) {
    return false;
  }

  return (
    profile.command === defaultMermaidWorkspaceMcpServerProfile.command &&
    profile.args.length === defaultMermaidWorkspaceMcpServerProfile.args.length &&
    profile.args.every((arg, index) => arg === defaultMermaidWorkspaceMcpServerProfile.args[index]) &&
    Object.keys(profile.env).length === 0 &&
    isLegacyDefaultWorkingDirectory(profile.cwd, legacyDefaultWorkingDirectory)
  );
}

function isLegacyDefaultFilesystemProfile(
  profile: WorkspaceMcpServerProfileConfig,
  legacyDefaultWorkingDirectory: string,
): profile is WorkspaceMcpServerProfileStdioConfig {
  if (profile.transport !== "stdio" || !defaultFilesystemWorkspaceMcpServerProfile) {
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

function isLegacyUnavailableDefaultStdioProfile(profile: WorkspaceMcpServerProfileConfig): boolean {
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

function resolveDefaultFilesystemWorkingDirectory(workspaceUserId: number): string {
  return resolveFoundryWorkspaceUserDirectory({
    workspaceUserId,
  });
}

function resolveLegacyFilesystemWorkingDirectory(): string {
  return resolveFoundryConfigDirectory();
}

function isLegacyDefaultWorkingDirectory(
  cwd: string | undefined,
  legacyDefaultWorkingDirectory: string,
): boolean {
  if (!cwd) {
    return true;
  }

  return normalizePathForComparison(cwd) === normalizePathForComparison(legacyDefaultWorkingDirectory);
}

function normalizePathForComparison(value: string): string {
  return value.trim().replaceAll("\\", "/").toLowerCase();
}

export function upsertWorkspaceMcpServerProfile(
  currentProfiles: WorkspaceMcpServerProfileConfig[],
  incoming: IncomingMcpServerConfig,
): { profile: WorkspaceMcpServerProfileConfig; profiles: WorkspaceMcpServerProfileConfig[]; warning: string | null } {
  const incomingKey = buildIncomingProfileKey(incoming);
  const keyIndex = currentProfiles.findIndex(
    (profile) => buildProfileKey(profile) === incomingKey,
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

  const profile: WorkspaceMcpServerProfileConfig =
    incoming.transport === "stdio"
      ? {
          id: profileId,
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
          name: incoming.name,
          connectOnThreadCreate,
          transport: incoming.transport,
          url: incoming.url,
          headers: incoming.headers,
          useAzureAuth: incoming.useAzureAuth,
          azureAuthScope: incoming.azureAuthScope,
          timeoutSeconds: incoming.timeoutSeconds,
        };

  const profiles =
    index >= 0
      ? currentProfiles.map((entry, entryIndex) => (entryIndex === index ? profile : entry))
      : [...currentProfiles, profile];

  let warning: string | null = null;
  if (keyIndex >= 0 && previousProfile) {
    warning =
      previousProfile.name === incoming.name
        ? "An MCP server with the same configuration already exists. Reused the existing saved profile."
        : `An MCP server with the same configuration already exists. Renamed it from "${previousProfile.name}" to "${incoming.name}".`;
  }

  return { profile, profiles, warning };
}

export function deleteWorkspaceMcpServerProfile(
  currentProfiles: WorkspaceMcpServerProfileConfig[],
  id: string,
): { profiles: WorkspaceMcpServerProfileConfig[]; deleted: boolean } {
  const nextProfiles = currentProfiles.filter((profile) => profile.id !== id);
  return {
    profiles: nextProfiles,
    deleted: nextProfiles.length !== currentProfiles.length,
  };
}

function normalizeStoredMcpServer(entry: unknown): WorkspaceMcpServerProfileConfig | null {
  const parsed = parseIncomingMcpServer(entry);
  if (!parsed.ok) {
    return null;
  }

  const id =
    isRecord(entry) && typeof entry.id === "string" && entry.id.trim()
      ? entry.id.trim()
      : createRandomId();
  const connectOnThreadCreate =
    isRecord(entry) && typeof entry.connectOnThreadCreate === "boolean"
      ? entry.connectOnThreadCreate
      : parsed.value.connectOnThreadCreate === true;

  return parsed.value.transport === "stdio"
    ? {
        id,
        name: parsed.value.name,
        connectOnThreadCreate,
        transport: parsed.value.transport,
        command: parsed.value.command,
        args: parsed.value.args,
        cwd: parsed.value.cwd,
        env: parsed.value.env,
      }
    : {
        id,
        name: parsed.value.name,
        connectOnThreadCreate,
        transport: parsed.value.transport,
        url: parsed.value.url,
        headers: parsed.value.headers,
        useAzureAuth: parsed.value.useAzureAuth,
        azureAuthScope: parsed.value.azureAuthScope,
        timeoutSeconds: parsed.value.timeoutSeconds,
      };
}

function normalizeStoredMcpServerRecord(entry: {
  id: string;
  name: string;
  transport: string;
  connectOnThreadCreate: boolean;
  url: string | null;
  headersJson: string | null;
  useAzureAuth: boolean;
  azureAuthScope: string | null;
  timeoutSeconds: number | null;
  command: string | null;
  argsJson: string | null;
  cwd: string | null;
  envJson: string | null;
}): WorkspaceMcpServerProfileConfig | null {
  const transport = readTransport(entry.transport);
  if (!transport) {
    return null;
  }

  if (transport === "stdio") {
    const args = parseStringArrayJson(entry.argsJson);
    const env = parseStringMapJson(entry.envJson);
    if (!args || !env || !entry.command) {
      return null;
    }

    return normalizeStoredMcpServer({
      id: entry.id,
      name: entry.name,
      connectOnThreadCreate: entry.connectOnThreadCreate === true,
      transport: "stdio",
      command: entry.command,
      args,
      cwd: entry.cwd ?? undefined,
      env,
    });
  }

  const headers = parseStringMapJson(entry.headersJson);
  if (!headers || !entry.url) {
    return null;
  }

  return normalizeStoredMcpServer({
    id: entry.id,
    name: entry.name,
    connectOnThreadCreate: entry.connectOnThreadCreate === true,
    transport,
    url: entry.url,
    headers,
    useAzureAuth: entry.useAzureAuth,
    azureAuthScope: entry.azureAuthScope ?? MCP_DEFAULT_AZURE_AUTH_SCOPE,
    timeoutSeconds: entry.timeoutSeconds ?? MCP_DEFAULT_TIMEOUT_SECONDS,
  });
}

function mapProfileToDatabaseRecord(userId: number, profile: WorkspaceMcpServerProfileConfig, profileOrder: number): {
  id: string;
  userId: number;
  profileOrder: number;
  connectOnThreadCreate: boolean;
  configKey: string;
  name: string;
  transport: string;
  url: string | null;
  headersJson: string | null;
  useAzureAuth: boolean;
  azureAuthScope: string | null;
  timeoutSeconds: number | null;
  command: string | null;
  argsJson: string | null;
  cwd: string | null;
  envJson: string | null;
} {
  if (profile.transport === "stdio") {
    return {
      id: profile.id,
      userId,
      profileOrder,
      connectOnThreadCreate: profile.connectOnThreadCreate,
      configKey: buildProfileKey(profile),
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
    connectOnThreadCreate: profile.connectOnThreadCreate,
    configKey: buildProfileKey(profile),
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

function parseStringArrayJson(value: string | null): string[] | null {
  if (typeof value !== "string") {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed)) {
    return null;
  }

  if (parsed.some((entry) => typeof entry !== "string")) {
    return null;
  }

  return [...parsed];
}

function parseStringMapJson(value: string | null): Record<string, string> | null {
  if (typeof value !== "string") {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) {
    return null;
  }

  const normalized: Record<string, string> = {};
  for (const [key, entryValue] of Object.entries(parsed)) {
    if (typeof entryValue !== "string") {
      return null;
    }
    normalized[key] = entryValue;
  }

  return normalized;
}

function buildIncomingProfileKey(profile: IncomingMcpServerConfig): string {
  return buildMcpServerConfigKey(profile);
}

export async function readAuthenticatedUser(): Promise<{ id: number } | null> {
  const userContext = await readAzureArmUserContext();
  if (!userContext) {
    return null;
  }

  const user = await getOrCreateUserByIdentity({
    tenantId: userContext.tenantId,
    principalId: userContext.principalId,
  });
  return { id: user.id };
}

function buildProfileKey(profile: WorkspaceMcpServerProfileConfig): string {
  return buildIncomingProfileKey(profile);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
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

export const mcpServersRouteTestUtils = {
  parseIncomingMcpServer,
  upsertWorkspaceMcpServerProfile,
  deleteWorkspaceMcpServerProfile,
  buildIncomingProfileKey,
  mergeDefaultWorkspaceMcpServerProfiles,
  resolveDefaultFilesystemWorkingDirectory,
};
