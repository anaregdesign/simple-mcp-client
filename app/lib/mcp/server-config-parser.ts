/**
 * Shared MCP server config parser for chat and workspace routes.
 */
import {
  ENV_KEY_PATTERN,
  MCP_AZURE_AUTH_SCOPE_MAX_LENGTH,
  MCP_DEFAULT_AZURE_AUTH_SCOPE,
  MCP_DEFAULT_TIMEOUT_SECONDS,
  MCP_HTTP_HEADERS_MAX,
  MCP_LEGACY_UNAVAILABLE_DEFAULT_STDIO_NPX_PACKAGE_NAMES,
  MCP_SERVER_NAME_MAX_LENGTH,
  MCP_STDIO_ARGS_MAX,
  MCP_STDIO_ENV_VARS_MAX,
  MCP_TIMEOUT_SECONDS_MAX,
  MCP_TIMEOUT_SECONDS_MIN,
} from "~/lib/constants";
import {
  isMcpHeaderCountWithinLimit,
  normalizeAndValidateMcpAzureAuthScope,
  validateMcpHeaderKey,
  validateMcpTimeoutSeconds,
} from "~/lib/mcp/validation";

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };
export type McpTransport = "streamable_http" | "sse" | "stdio";

export type ParsedMcpHttpServerConfig = {
  name: string;
  transport: "streamable_http" | "sse";
  url: string;
  headers: Record<string, string>;
  useAzureAuth: boolean;
  azureAuthScope: string;
  timeoutSeconds: number;
};

export type ParsedMcpStdioServerConfig = {
  name: string;
  transport: "stdio";
  command: string;
  args: string[];
  cwd?: string;
  env: Record<string, string>;
};

export type ParsedMcpServerConfig = ParsedMcpHttpServerConfig | ParsedMcpStdioServerConfig;

export type ParsedIncomingMcpServerConfig =
  | (ParsedMcpHttpServerConfig & {
      id?: string;
      connectOnThreadCreate?: boolean;
    })
  | (ParsedMcpStdioServerConfig & {
      id?: string;
      connectOnThreadCreate?: boolean;
    });

const legacyUnavailableDefaultStdioNpxPackageNameSet = new Set<string>(
  MCP_LEGACY_UNAVAILABLE_DEFAULT_STDIO_NPX_PACKAGE_NAMES,
);

export function parseIncomingMcpServer(
  payload: unknown,
): ParseResult<ParsedIncomingMcpServerConfig> {
  if (!isRecord(payload)) {
    return { ok: false, error: "Invalid MCP server payload." };
  }

  const transport = readTransport(payload.transport);
  if (!transport) {
    return {
      ok: false,
      error: "`transport` must be \"streamable_http\", \"sse\", or \"stdio\".",
    };
  }

  if (transport === "stdio") {
    const parsedStdio = parseStdioConfig(payload, {
      argsLabel: "`args`",
      argItemLabel: (index) => `args[${index}]`,
      envLabel: "`env`",
      envKeyLabel: (key) => `env[${key}]`,
      commandRequiredMessage: "`command` is required for stdio transport.",
      commandSpacesMessage: "`command` must not include spaces.",
      invalidEnvKeyMessage: (key) => `Invalid env key: ${key}`,
      nameRequiredMessage: "`name` is required.",
    });
    if (!parsedStdio.ok) {
      return parsedStdio;
    }

    const connectOnThreadCreateResult = parseConnectOnThreadCreate(payload.connectOnThreadCreate);
    if (!connectOnThreadCreateResult.ok) {
      return connectOnThreadCreateResult;
    }

    const id = normalizeOptionalId(payload.id);
    return {
      ok: true,
      value: {
        ...(id ? { id } : {}),
        ...(connectOnThreadCreateResult.value === undefined
          ? {}
          : { connectOnThreadCreate: connectOnThreadCreateResult.value }),
        ...parsedStdio.value,
      },
    };
  }

  const parsedHttp = parseHttpConfig(payload, transport, {
    urlRequiredMessage: "`url` is required.",
    invalidUrlMessage: "`url` is invalid.",
    invalidUrlSchemeMessage: "`url` must start with http://, https://, or /.",
    headersLabel: "`headers`",
    headersKeyLabel: (key) => `headers[${key}]`,
    invalidHeaderKeyMessage: (key) => `Invalid header key: ${key}`,
    reservedContentTypeMessage:
      '`headers` must not include "Content-Type". It is fixed to "application/json".',
    azureAuthScopeLabel: "`azureAuthScope`",
    timeoutLabel: "`timeoutSeconds`",
    nameRequiredMessage: "`name` is required.",
    relativeUrlMode: "workspace_profile",
  });
  if (!parsedHttp.ok) {
    return parsedHttp;
  }

  const connectOnThreadCreateResult = parseConnectOnThreadCreate(payload.connectOnThreadCreate);
  if (!connectOnThreadCreateResult.ok) {
    return connectOnThreadCreateResult;
  }

  const id = normalizeOptionalId(payload.id);
  return {
    ok: true,
    value: {
      ...(id ? { id } : {}),
      ...(connectOnThreadCreateResult.value === undefined
        ? {}
        : { connectOnThreadCreate: connectOnThreadCreateResult.value }),
      ...parsedHttp.value,
    },
  };
}

export function parseChatMcpServerEntry(
  payload: unknown,
  options: {
    index: number;
    requestUrl?: string;
  } = {
    index: 0,
  },
): ParseResult<ParsedMcpServerConfig | null> {
  if (!isRecord(payload)) {
    return { ok: false, error: `mcpServers[${options.index}] is invalid.` };
  }

  const rawTransport = payload.transport;
  const transport =
    rawTransport === undefined || rawTransport === null
      ? "streamable_http"
      : readTransport(rawTransport);
  if (!transport) {
    return {
      ok: false,
      error: `mcpServers[${options.index}].transport must be \"streamable_http\", \"sse\", or \"stdio\".`,
    };
  }

  if (transport === "stdio") {
    const parsedStdio = parseStdioConfig(payload, {
      argsLabel: `mcpServers[${options.index}].args`,
      argItemLabel: (argIndex) => `mcpServers[${options.index}].args[${argIndex}]`,
      envLabel: `mcpServers[${options.index}].env`,
      envKeyLabel: (key) => `mcpServers[${options.index}].env[\"${key}\"]`,
      commandRequiredMessage: `mcpServers[${options.index}].command is required for stdio.`,
      commandSpacesMessage: `mcpServers[${options.index}].command must not include spaces.`,
      invalidEnvKeyMessage: (key) => `mcpServers[${options.index}].env key \"${key}\" is invalid.`,
      nameRequiredMessage: `mcpServers[${options.index}].name is required.`,
    });
    if (!parsedStdio.ok) {
      return parsedStdio;
    }

    if (isLegacyUnavailableDefaultStdioNpxServer(parsedStdio.value)) {
      return { ok: true, value: null };
    }

    return {
      ok: true,
      value: parsedStdio.value,
    };
  }

  return parseHttpConfig(payload, transport, {
    urlRequiredMessage: `mcpServers[${options.index}].url is required.`,
    invalidUrlMessage: `mcpServers[${options.index}].url is invalid.`,
    invalidUrlSchemeMessage: `mcpServers[${options.index}].url must start with http://, https://, or /.`,
    headersLabel: `mcpServers[${options.index}].headers`,
    headersKeyLabel: (key) => `mcpServers[${options.index}].headers[\"${key}\"]`,
    invalidHeaderKeyMessage: (key) => `mcpServers[${options.index}].headers key \"${key}\" is invalid.`,
    reservedContentTypeMessage:
      `mcpServers[${options.index}].headers cannot include \"Content-Type\". It is fixed to \"application/json\".`,
    azureAuthScopeLabel: `mcpServers[${options.index}].azureAuthScope`,
    timeoutLabel: `mcpServers[${options.index}].timeoutSeconds`,
    nameRequiredMessage: `mcpServers[${options.index}].name is required.`,
    relativeUrlMode: "chat",
    requestUrl: options.requestUrl,
  });
}

export function readTransport(value: unknown): McpTransport | null {
  if (value === "streamable_http" || value === "sse" || value === "stdio") {
    return value;
  }
  return null;
}

type ParseStdioLabels = {
  argsLabel: string;
  argItemLabel: (index: number) => string;
  envLabel: string;
  envKeyLabel: (key: string) => string;
  commandRequiredMessage: string;
  commandSpacesMessage: string;
  invalidEnvKeyMessage: (key: string) => string;
  nameRequiredMessage: string;
};

function parseStdioConfig(
  payload: Record<string, unknown>,
  labels: ParseStdioLabels,
): ParseResult<ParsedMcpStdioServerConfig> {
  const command = typeof payload.command === "string" ? payload.command.trim() : "";
  if (!command) {
    return { ok: false, error: labels.commandRequiredMessage };
  }

  if (/\s/.test(command)) {
    return { ok: false, error: labels.commandSpacesMessage };
  }

  const argsResult = parseArgs(payload.args, labels.argsLabel, labels.argItemLabel);
  if (!argsResult.ok) {
    return argsResult;
  }

  const envResult = parseEnv(payload.env, labels.envLabel, labels.envKeyLabel, labels.invalidEnvKeyMessage);
  if (!envResult.ok) {
    return envResult;
  }

  const cwd = typeof payload.cwd === "string" ? payload.cwd.trim() : "";
  const name = normalizeName(payload.name, command);
  if (!name) {
    return { ok: false, error: labels.nameRequiredMessage };
  }

  return {
    ok: true,
    value: {
      name,
      transport: "stdio",
      command,
      args: argsResult.value,
      cwd: cwd || undefined,
      env: envResult.value,
    },
  };
}

type ParseHttpLabels = {
  urlRequiredMessage: string;
  invalidUrlMessage: string;
  invalidUrlSchemeMessage: string;
  headersLabel: string;
  headersKeyLabel: (key: string) => string;
  invalidHeaderKeyMessage: (key: string) => string;
  reservedContentTypeMessage: string;
  azureAuthScopeLabel: string;
  timeoutLabel: string;
  nameRequiredMessage: string;
  relativeUrlMode: "chat" | "workspace_profile";
  requestUrl?: string;
};

function parseHttpConfig(
  payload: Record<string, unknown>,
  transport: "streamable_http" | "sse",
  labels: ParseHttpLabels,
): ParseResult<ParsedMcpHttpServerConfig> {
  const rawUrl = typeof payload.url === "string" ? payload.url.trim() : "";
  if (!rawUrl) {
    return { ok: false, error: labels.urlRequiredMessage };
  }

  const parsedUrlResult =
    labels.relativeUrlMode === "chat"
      ? parseMcpHttpUrlForChat(rawUrl, labels.invalidUrlMessage, labels.invalidUrlSchemeMessage, labels.requestUrl)
      : parseMcpHttpUrlForWorkspaceProfile(rawUrl, labels.invalidUrlMessage, labels.invalidUrlSchemeMessage);
  if (!parsedUrlResult.ok) {
    return parsedUrlResult;
  }

  const name = normalizeName(payload.name, parsedUrlResult.value.nameFallback);
  if (!name) {
    return { ok: false, error: labels.nameRequiredMessage };
  }

  const headersResult = parseHttpHeaders(
    payload.headers,
    labels.headersLabel,
    labels.headersKeyLabel,
    labels.invalidHeaderKeyMessage,
    labels.reservedContentTypeMessage,
  );
  if (!headersResult.ok) {
    return headersResult;
  }

  const useAzureAuth = payload.useAzureAuth === true;
  const scopeResult = parseAzureAuthScope(payload.azureAuthScope, labels.azureAuthScopeLabel, useAzureAuth);
  if (!scopeResult.ok) {
    return scopeResult;
  }

  const timeoutResult = parseTimeoutSeconds(payload.timeoutSeconds, labels.timeoutLabel);
  if (!timeoutResult.ok) {
    return timeoutResult;
  }

  return {
    ok: true,
    value: {
      name,
      transport,
      url: parsedUrlResult.value.url,
      headers: headersResult.value,
      useAzureAuth,
      azureAuthScope: scopeResult.value,
      timeoutSeconds: timeoutResult.value,
    },
  };
}

function parseMcpHttpUrlForWorkspaceProfile(
  rawUrl: string,
  invalidUrlMessage: string,
  invalidUrlSchemeMessage: string,
): ParseResult<{ url: string; nameFallback: string }> {
  if (rawUrl.startsWith("/") && !rawUrl.startsWith("//")) {
    let parsedRelativeUrl: URL;
    try {
      parsedRelativeUrl = new URL(rawUrl, "http://localhost");
    } catch {
      return { ok: false, error: invalidUrlMessage };
    }

    const pathname = parsedRelativeUrl.pathname || "/";
    const normalizedRelativeUrl = `${pathname}${parsedRelativeUrl.search}`;
    const pathSegments = pathname
      .split("/")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    const nameFallback = pathSegments[pathSegments.length - 1] ?? "local";
    return {
      ok: true,
      value: {
        url: normalizedRelativeUrl,
        nameFallback,
      },
    };
  }

  let parsedAbsoluteUrl: URL;
  try {
    parsedAbsoluteUrl = new URL(rawUrl);
  } catch {
    return { ok: false, error: invalidUrlMessage };
  }

  if (parsedAbsoluteUrl.protocol !== "http:" && parsedAbsoluteUrl.protocol !== "https:") {
    return { ok: false, error: invalidUrlSchemeMessage };
  }

  return {
    ok: true,
    value: {
      url: parsedAbsoluteUrl.toString(),
      nameFallback: parsedAbsoluteUrl.hostname,
    },
  };
}

function parseMcpHttpUrlForChat(
  rawUrl: string,
  invalidUrlMessage: string,
  invalidUrlSchemeMessage: string,
  requestUrl?: string,
): ParseResult<{ url: string; nameFallback: string }> {
  const requestOrigin = readRequestOrigin(requestUrl);
  if (rawUrl.startsWith("/") && !rawUrl.startsWith("//")) {
    if (!requestOrigin) {
      return { ok: false, error: invalidUrlMessage };
    }

    let resolvedUrl: URL;
    try {
      resolvedUrl = new URL(rawUrl, requestOrigin);
    } catch {
      return { ok: false, error: invalidUrlMessage };
    }

    if (resolvedUrl.protocol !== "http:" && resolvedUrl.protocol !== "https:") {
      return {
        ok: false,
        error: invalidUrlSchemeMessage,
      };
    }

    const pathSegments = resolvedUrl.pathname
      .split("/")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    const nameFallback = pathSegments[pathSegments.length - 1] ?? resolvedUrl.hostname;
    return {
      ok: true,
      value: {
        url: resolvedUrl.toString(),
        nameFallback,
      },
    };
  }

  let parsedAbsoluteUrl: URL;
  try {
    parsedAbsoluteUrl = new URL(rawUrl);
  } catch {
    return { ok: false, error: invalidUrlMessage };
  }

  if (parsedAbsoluteUrl.protocol !== "http:" && parsedAbsoluteUrl.protocol !== "https:") {
    return { ok: false, error: invalidUrlSchemeMessage };
  }

  return {
    ok: true,
    value: {
      url: parsedAbsoluteUrl.toString(),
      nameFallback: parsedAbsoluteUrl.hostname,
    },
  };
}

function readRequestOrigin(requestUrl?: string): string | null {
  if (typeof requestUrl !== "string") {
    return null;
  }

  const trimmed = requestUrl.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

function parseConnectOnThreadCreate(value: unknown): ParseResult<boolean | undefined> {
  if (value === undefined) {
    return { ok: true, value: undefined };
  }

  if (typeof value !== "boolean") {
    return { ok: false, error: "`connectOnThreadCreate` must be a boolean." };
  }

  return { ok: true, value };
}

function parseArgs(
  argsValue: unknown,
  argsLabel: string,
  argItemLabel: (index: number) => string,
): ParseResult<string[]> {
  if (argsValue === undefined || argsValue === null) {
    return { ok: true, value: [] };
  }

  if (!Array.isArray(argsValue)) {
    return { ok: false, error: `${argsLabel} must be an array of strings.` };
  }

  if (argsValue.length > MCP_STDIO_ARGS_MAX) {
    return {
      ok: false,
      error: `${argsLabel} can include up to ${MCP_STDIO_ARGS_MAX} entries.`,
    };
  }

  const args: string[] = [];
  for (const [index, arg] of argsValue.entries()) {
    if (typeof arg !== "string") {
      return { ok: false, error: `${argItemLabel(index)} must be a string.` };
    }

    const trimmed = arg.trim();
    if (!trimmed) {
      return {
        ok: false,
        error: `${argItemLabel(index)} must not be empty.`,
      };
    }

    args.push(trimmed);
  }

  return { ok: true, value: args };
}

function parseEnv(
  envValue: unknown,
  envLabel: string,
  envKeyLabel: (key: string) => string,
  invalidEnvKeyMessage: (key: string) => string,
): ParseResult<Record<string, string>> {
  if (envValue === undefined || envValue === null) {
    return { ok: true, value: {} };
  }

  if (!isRecord(envValue)) {
    return { ok: false, error: `${envLabel} must be an object.` };
  }

  const entries = Object.entries(envValue);
  if (entries.length > MCP_STDIO_ENV_VARS_MAX) {
    return {
      ok: false,
      error: `${envLabel} can include up to ${MCP_STDIO_ENV_VARS_MAX} entries.`,
    };
  }

  const env: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (!ENV_KEY_PATTERN.test(key)) {
      return { ok: false, error: invalidEnvKeyMessage(key) };
    }

    if (typeof value !== "string") {
      return { ok: false, error: `${envKeyLabel(key)} must be a string.` };
    }

    env[key] = value;
  }

  return { ok: true, value: env };
}

function parseHttpHeaders(
  headersValue: unknown,
  headersLabel: string,
  headersKeyLabel: (key: string) => string,
  invalidHeaderKeyMessage: (key: string) => string,
  reservedContentTypeMessage: string,
): ParseResult<Record<string, string>> {
  if (headersValue === undefined || headersValue === null) {
    return { ok: true, value: {} };
  }

  if (!isRecord(headersValue)) {
    return { ok: false, error: `${headersLabel} must be an object.` };
  }

  const entries = Object.entries(headersValue);
  if (!isMcpHeaderCountWithinLimit(entries.length)) {
    return {
      ok: false,
      error: `${headersLabel} can include up to ${MCP_HTTP_HEADERS_MAX} entries.`,
    };
  }

  const headers: Record<string, string> = {};
  for (const [key, value] of entries) {
    const headerKeyValidation = validateMcpHeaderKey(key);
    if (!headerKeyValidation.ok && headerKeyValidation.reason === "invalid_key") {
      return { ok: false, error: invalidHeaderKeyMessage(key) };
    }

    if (!headerKeyValidation.ok && headerKeyValidation.reason === "reserved_content_type") {
      return {
        ok: false,
        error: reservedContentTypeMessage,
      };
    }

    if (typeof value !== "string") {
      return {
        ok: false,
        error: `${headersKeyLabel(key)} must be a string.`,
      };
    }

    headers[key] = value;
  }

  return { ok: true, value: headers };
}

function parseAzureAuthScope(
  rawScope: unknown,
  scopeLabel: string,
  useAzureAuth: boolean,
): ParseResult<string> {
  if (rawScope === undefined || rawScope === null) {
    return { ok: true, value: MCP_DEFAULT_AZURE_AUTH_SCOPE };
  }

  if (typeof rawScope !== "string") {
    return { ok: false, error: `${scopeLabel} must be a string.` };
  }

  const scopeValidation = normalizeAndValidateMcpAzureAuthScope(rawScope);
  if (!scopeValidation.ok) {
    if (scopeValidation.reason === "too_long") {
      return {
        ok: false,
        error: `${scopeLabel} must be ${MCP_AZURE_AUTH_SCOPE_MAX_LENGTH} characters or fewer.`,
      };
    }

    return { ok: false, error: `${scopeLabel} must not include spaces.` };
  }

  if (useAzureAuth && !scopeValidation.value) {
    return { ok: false, error: `${scopeLabel} is required when useAzureAuth is true.` };
  }

  return { ok: true, value: scopeValidation.value };
}

function parseTimeoutSeconds(
  rawTimeout: unknown,
  timeoutLabel: string,
): ParseResult<number> {
  if (rawTimeout === undefined || rawTimeout === null) {
    return { ok: true, value: MCP_DEFAULT_TIMEOUT_SECONDS };
  }

  if (typeof rawTimeout !== "number") {
    return { ok: false, error: `${timeoutLabel} must be an integer.` };
  }

  const timeoutValidation = validateMcpTimeoutSeconds(rawTimeout);
  if (!timeoutValidation.ok) {
    if (timeoutValidation.reason === "not_integer") {
      return { ok: false, error: `${timeoutLabel} must be an integer.` };
    }

    return {
      ok: false,
      error: `${timeoutLabel} must be between ${MCP_TIMEOUT_SECONDS_MIN} and ${MCP_TIMEOUT_SECONDS_MAX}.`,
    };
  }

  return { ok: true, value: timeoutValidation.value };
}

function isLegacyUnavailableDefaultStdioNpxServer(config: {
  command: string;
  args: string[];
  cwd?: string;
  env: Record<string, string>;
}): boolean {
  return (
    config.command === "npx" &&
    config.args.length === 2 &&
    config.args[0] === "-y" &&
    legacyUnavailableDefaultStdioNpxPackageNameSet.has(config.args[1]) &&
    !config.cwd &&
    Object.keys(config.env).length === 0
  );
}

function normalizeName(rawName: unknown, fallback: string): string {
  const preferred = typeof rawName === "string" ? rawName.trim() : "";
  const normalized = (preferred || fallback).trim();
  return normalized.slice(0, MCP_SERVER_NAME_MAX_LENGTH);
}

function normalizeOptionalId(rawId: unknown): string | null {
  if (typeof rawId !== "string") {
    return null;
  }
  const trimmed = rawId.trim();
  return trimmed ? trimmed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
