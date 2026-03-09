import {
  ENV_KEY_PATTERN,
  HTTP_HEADER_NAME_PATTERN,
  MCP_AZURE_AUTH_SCOPE_MAX_LENGTH,
  MCP_DEFAULT_AZURE_AUTH_SCOPE,
  MCP_DEFAULT_TIMEOUT_SECONDS,
  MCP_HTTP_HEADERS_MAX,
  MCP_TIMEOUT_SECONDS_MAX,
  MCP_TIMEOUT_SECONDS_MIN,
} from "~/lib/constants/mcp";
import { buildMcpServerConfigKey } from "~/lib/contracts/mcp/config-key";

export type WorkspaceMcpServerProfileResource = {
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
};

export type McpHttpServerConfig = {
  id: string;
  name: string;
  connectOnThreadCreate?: boolean;
  transport: "streamable_http" | "sse";
  url: string;
  headers: Record<string, string>;
  useAzureAuth: boolean;
  azureAuthScope: string;
  timeoutSeconds: number;
};

export type McpStdioServerConfig = {
  id: string;
  name: string;
  connectOnThreadCreate?: boolean;
  transport: "stdio";
  command: string;
  args: string[];
  cwd?: string;
  env: Record<string, string>;
};

export type McpServerConfig = McpHttpServerConfig | McpStdioServerConfig;

type SaveMcpHttpServerRequest = Omit<McpHttpServerConfig, "id"> & { id?: string };
type SaveMcpStdioServerRequest = Omit<McpStdioServerConfig, "id"> & { id?: string };

export type SaveMcpServerRequest = SaveMcpHttpServerRequest | SaveMcpStdioServerRequest;

export function buildMcpServerKey(server: McpServerConfig): string {
  return buildMcpServerConfigKey(server);
}

export function readMcpServerList(value: unknown): McpServerConfig[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const servers: McpServerConfig[] = [];
  for (const entry of value) {
    const server = readMcpServerFromUnknown(entry);
    if (!server) {
      continue;
    }
    servers.push(server);
  }

  return servers;
}

export function readWorkspaceMcpServerProfileResourceList(
  value: unknown,
): WorkspaceMcpServerProfileResource[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const profiles: WorkspaceMcpServerProfileResource[] = [];
  const seenIds = new Set<string>();
  for (const entry of value) {
    const profile = readWorkspaceMcpServerProfileResourceFromUnknown(entry);
    if (!profile || seenIds.has(profile.id)) {
      continue;
    }

    seenIds.add(profile.id);
    profiles.push(profile);
  }

  return profiles;
}

export function readWorkspaceMcpServerProfileResourceFromUnknown(
  value: unknown,
): WorkspaceMcpServerProfileResource | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.id !== "string" ||
    typeof value.userId !== "number" ||
    typeof value.profileOrder !== "number" ||
    typeof value.connectOnThreadCreate !== "boolean" ||
    typeof value.configKey !== "string" ||
    typeof value.name !== "string" ||
    typeof value.transport !== "string"
  ) {
    return null;
  }

  return value as WorkspaceMcpServerProfileResource;
}

export function readMcpServerFromUnknown(value: unknown): McpServerConfig | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = typeof value.id === "string" ? value.id.trim() : "";
  if (!id) {
    return null;
  }

  const name = typeof value.name === "string" ? value.name.trim() : "";
  if (!name) {
    return null;
  }
  const connectOnThreadCreate = value.connectOnThreadCreate === true;

  const transport = value.transport;
  if (transport === "stdio") {
    const command = typeof value.command === "string" ? value.command.trim() : "";
    if (!command) {
      return null;
    }

    if (!Array.isArray(value.args) || !value.args.every((arg) => typeof arg === "string")) {
      return null;
    }

    const envValue = value.env;
    if (
      !isRecord(envValue) ||
      !Object.values(envValue).every((entry) => typeof entry === "string")
    ) {
      return null;
    }

    return {
      id,
      name,
      connectOnThreadCreate,
      transport,
      command,
      args: value.args.map((arg) => arg.trim()).filter(Boolean),
      cwd: typeof value.cwd === "string" && value.cwd.trim() ? value.cwd.trim() : undefined,
      env: Object.fromEntries(
        Object.entries(envValue)
          .filter(([key, entry]) => ENV_KEY_PATTERN.test(key) && typeof entry === "string")
          .map(([key, entry]) => [key, entry as string]),
      ),
    };
  }

  if (transport !== "streamable_http" && transport !== "sse") {
    return null;
  }

  const url = typeof value.url === "string" ? value.url.trim() : "";
  if (!url) {
    return null;
  }

  const headers = readHttpHeadersFromUnknown(value.headers);
  if (headers === null) {
    return null;
  }

  return {
    id,
    name,
    connectOnThreadCreate,
    transport,
    url,
    headers,
    useAzureAuth: value.useAzureAuth === true,
    azureAuthScope: readAzureAuthScopeFromUnknown(value.azureAuthScope),
    timeoutSeconds: readMcpTimeoutSecondsFromUnknown(value.timeoutSeconds),
  };
}

export function serializeMcpServerForSave(
  server: McpServerConfig,
  options: {
    includeId?: boolean;
  } = {},
): SaveMcpServerRequest {
  const includeId = options.includeId === true;
  if (server.transport === "stdio") {
    const payload: SaveMcpStdioServerRequest = {
      name: server.name,
      ...(typeof server.connectOnThreadCreate === "boolean"
        ? { connectOnThreadCreate: server.connectOnThreadCreate }
        : {}),
      transport: server.transport,
      command: server.command,
      args: server.args,
      cwd: server.cwd,
      env: server.env,
    };
    return includeId ? { ...payload, id: server.id } : payload;
  }

  const payload: SaveMcpHttpServerRequest = {
    name: server.name,
    ...(typeof server.connectOnThreadCreate === "boolean"
      ? { connectOnThreadCreate: server.connectOnThreadCreate }
      : {}),
    transport: server.transport,
    url: server.url,
    headers: server.headers,
    useAzureAuth: server.useAzureAuth,
    azureAuthScope: server.azureAuthScope,
    timeoutSeconds: server.timeoutSeconds,
  };
  return includeId ? { ...payload, id: server.id } : payload;
}

export function readMcpServerFromWorkspaceProfileResource(
  profile: WorkspaceMcpServerProfileResource,
): McpServerConfig | null {
  return readMcpServerFromUnknown(
    profile.transport === "stdio"
      ? {
          id: profile.id,
          name: profile.name,
          connectOnThreadCreate: profile.connectOnThreadCreate,
          transport: profile.transport,
          command: profile.command ?? "",
          args: readStringArrayJson(profile.argsJson),
          cwd: profile.cwd ?? undefined,
          env: readStringMapJson(profile.envJson),
        }
      : {
          id: profile.id,
          name: profile.name,
          connectOnThreadCreate: profile.connectOnThreadCreate,
          transport: profile.transport,
          url: profile.url ?? "",
          headers: readStringMapJson(profile.headersJson),
          useAzureAuth: profile.useAzureAuth,
          azureAuthScope: profile.azureAuthScope ?? MCP_DEFAULT_AZURE_AUTH_SCOPE,
          timeoutSeconds: profile.timeoutSeconds ?? MCP_DEFAULT_TIMEOUT_SECONDS,
        },
  );
}

export function upsertMcpServer(
  current: McpServerConfig[],
  profile: McpServerConfig,
): McpServerConfig[] {
  const existingIndex = current.findIndex((entry) => entry.id === profile.id);
  if (existingIndex < 0) {
    return [...current, profile];
  }

  return current.map((entry, index) => (index === existingIndex ? profile : entry));
}

export function formatMcpServerOption(server: McpServerConfig): string {
  if (server.transport === "stdio") {
    return `${server.name} (stdio: ${server.command})`;
  }

  const headerCount = Object.keys(server.headers).length;
  const azureAuthLabel = server.useAzureAuth ? `, Azure auth (${server.azureAuthScope})` : "";
  const timeoutLabel = `, timeout ${server.timeoutSeconds}s`;
  if (headerCount > 0) {
    return `${server.name} (${server.transport}, +${headerCount} headers${azureAuthLabel}${timeoutLabel})`;
  }
  return `${server.name} (${server.transport}${azureAuthLabel}${timeoutLabel})`;
}

function readHttpHeadersFromUnknown(value: unknown): Record<string, string> | null {
  if (value === undefined || value === null) {
    return {};
  }

  if (!isRecord(value)) {
    return null;
  }

  const headers: Record<string, string> = {};
  let count = 0;
  for (const [key, rawValue] of Object.entries(value)) {
    if (!HTTP_HEADER_NAME_PATTERN.test(key)) {
      return null;
    }
    if (key.toLowerCase() === "content-type") {
      continue;
    }
    if (typeof rawValue !== "string") {
      return null;
    }

    headers[key] = rawValue;
    count += 1;
    if (count > MCP_HTTP_HEADERS_MAX) {
      return null;
    }
  }

  return headers;
}

function readAzureAuthScopeFromUnknown(value: unknown): string {
  if (typeof value !== "string") {
    return MCP_DEFAULT_AZURE_AUTH_SCOPE;
  }

  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed)) {
    return MCP_DEFAULT_AZURE_AUTH_SCOPE;
  }

  if (trimmed.length > MCP_AZURE_AUTH_SCOPE_MAX_LENGTH) {
    return MCP_DEFAULT_AZURE_AUTH_SCOPE;
  }

  return trimmed;
}

function readMcpTimeoutSecondsFromUnknown(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    return MCP_DEFAULT_TIMEOUT_SECONDS;
  }

  if (value < MCP_TIMEOUT_SECONDS_MIN || value > MCP_TIMEOUT_SECONDS_MAX) {
    return MCP_DEFAULT_TIMEOUT_SECONDS;
  }

  return value;
}

function readStringArrayJson(value: string | null): string[] {
  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((entry) => typeof entry === "string")
      ? parsed
      : [];
  } catch {
    return [];
  }
}

function readStringMapJson(value: string | null): Record<string, string> {
  if (typeof value !== "string") {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    if (!isRecord(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
  } catch {
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
