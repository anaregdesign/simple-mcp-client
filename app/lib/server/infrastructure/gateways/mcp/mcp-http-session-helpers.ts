import {
  MCP_DEFAULT_HTTP_HEADERS,
  MCP_LOCAL_PLAYGROUND_CLIENT_PLATFORM_HEADER,
  MCP_LOCAL_PLAYGROUND_CLIENT_USER_AGENT_HEADER,
  MCP_LOCAL_PLAYGROUND_THREAD_ID_HEADER,
  MCP_LOCAL_PLAYGROUND_TURN_ID_HEADER,
} from "~/lib/constants/mcp";
import type {
  ClientMcpServerConfig,
} from "~/lib/server/infrastructure/gateways/chat/request-parser";

export type McpRequestContext = {
  threadId: string | null;
  turnId: string | null;
  clientUserAgent: string | null;
  clientPlatform: string | null;
};

type ClientMcpHttpServerConfig = Extract<
  ClientMcpServerConfig,
  { transport: "streamable_http" | "sse" }
>;

export async function buildMcpHttpRuntimeHeaders(
  config: ClientMcpHttpServerConfig,
  refreshState: {
    requestContext: McpRequestContext;
    getAzureAuthorizationToken: (scope: string) => Promise<string>;
  } & Record<string, unknown>,
): Promise<Record<string, string>> {
  const headers = buildMcpHttpRequestHeaders(config.headers);
  const contextHeaders = buildMcpContextRequestHeaders(
    config,
    refreshState.requestContext,
  );
  for (const [key, value] of Object.entries(contextHeaders)) {
    headers[key] = value;
  }
  if (config.useAzureAuth) {
    const token = await refreshState.getAzureAuthorizationToken(
      config.azureAuthScope,
    );
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

export function buildMcpHttpRequestHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  const mergedHeaders: Record<string, string> = { ...MCP_DEFAULT_HTTP_HEADERS };
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === "content-type") {
      continue;
    }
    mergedHeaders[key] = value;
  }

  return mergedHeaders;
}

export function buildMcpContextRequestHeaders(
  serverConfig: ClientMcpServerConfig,
  requestContext: McpRequestContext,
): Record<string, string> {
  if (
    serverConfig.transport === "stdio" ||
    !isLocalPlaygroundMcpContextUrl(serverConfig.url)
  ) {
    return {};
  }

  const contextHeaders: Record<string, string> = {};
  if (requestContext.threadId) {
    contextHeaders[MCP_LOCAL_PLAYGROUND_THREAD_ID_HEADER] =
      requestContext.threadId;
  }
  if (requestContext.turnId) {
    contextHeaders[MCP_LOCAL_PLAYGROUND_TURN_ID_HEADER] = requestContext.turnId;
  }
  if (requestContext.clientUserAgent) {
    contextHeaders[MCP_LOCAL_PLAYGROUND_CLIENT_USER_AGENT_HEADER] =
      requestContext.clientUserAgent;
  }
  if (requestContext.clientPlatform) {
    contextHeaders[MCP_LOCAL_PLAYGROUND_CLIENT_PLATFORM_HEADER] =
      requestContext.clientPlatform;
  }
  return contextHeaders;
}

export function isLocalPlaygroundMcpContextUrl(rawUrl: string): boolean {
  const trimmedUrl = rawUrl.trim();
  if (!trimmedUrl) {
    return false;
  }

  if (trimmedUrl.startsWith("/") && !trimmedUrl.startsWith("//")) {
    let parsedRelativeUrl: URL;
    try {
      parsedRelativeUrl = new URL(trimmedUrl, "http://localhost");
    } catch {
      return false;
    }

    const normalizedRelativePath = parsedRelativeUrl.pathname.replace(
      /\/+$/,
      "",
    );
    return normalizedRelativePath === "/mcp/cmd";
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmedUrl);
  } catch {
    return false;
  }

  const normalizedPathname = parsedUrl.pathname.replace(/\/+$/, "");
  if (normalizedPathname !== "/mcp/cmd") {
    return false;
  }

  const hostname = parsedUrl.hostname.trim().toLowerCase();
  return (
    hostname === "localhost" ||
    hostname === "::1" ||
    hostname === "0.0.0.0" ||
    hostname === "127.0.0.1" ||
    hostname.startsWith("127.")
  );
}

export async function fetchWithMcpMetaNormalization(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(input, init);
  const contentType = (
    response.headers.get("content-type") ?? ""
  ).toLowerCase();
  if (!contentType.includes("application/json")) {
    return response;
  }

  let parsedBody: unknown;
  try {
    parsedBody = await response.clone().json();
  } catch {
    return response;
  }

  const normalizedMetaBody = normalizeMcpMetaNulls(parsedBody);
  const normalizedInitializeBody = normalizeMcpInitializeNullOptionals(
    normalizedMetaBody.value,
  );
  const normalizedToolsBody = normalizeMcpListToolsNullOptionals(
    normalizedInitializeBody.value,
  );
  if (
    !normalizedMetaBody.changed &&
    !normalizedInitializeBody.changed &&
    !normalizedToolsBody.changed
  ) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return new Response(JSON.stringify(normalizedToolsBody.value), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function normalizeMcpMetaNulls(value: unknown): {
  value: unknown;
  changed: boolean;
} {
  if (Array.isArray(value)) {
    let changed = false;
    const normalizedArray = value.map((entry) => {
      const normalized = normalizeMcpMetaNulls(entry);
      if (normalized.changed) {
        changed = true;
      }
      return normalized.value;
    });

    return changed
      ? { value: normalizedArray, changed: true }
      : { value, changed: false };
  }

  if (!isRecord(value)) {
    return { value, changed: false };
  }

  let changed = false;
  const normalizedObject: Record<string, unknown> = {};
  for (const [key, rawEntryValue] of Object.entries(value)) {
    if (key === "_meta" && rawEntryValue === null) {
      normalizedObject[key] = {};
      changed = true;
      continue;
    }

    const normalizedEntry = normalizeMcpMetaNulls(rawEntryValue);
    normalizedObject[key] = normalizedEntry.value;
    if (normalizedEntry.changed) {
      changed = true;
    }
  }

  return changed
    ? { value: normalizedObject, changed: true }
    : { value, changed: false };
}

export function normalizeMcpInitializeNullOptionals(value: unknown): {
  value: unknown;
  changed: boolean;
} {
  if (Array.isArray(value)) {
    let changed = false;
    const normalizedArray = value.map((entry) => {
      const normalized = normalizeMcpInitializeNullOptionals(entry);
      if (normalized.changed) {
        changed = true;
      }
      return normalized.value;
    });

    return changed
      ? { value: normalizedArray, changed: true }
      : { value, changed: false };
  }

  if (!isRecord(value)) {
    return { value, changed: false };
  }

  const resultValue = value.result;
  if (!isRecord(resultValue) || !looksLikeInitializeResult(resultValue)) {
    return { value, changed: false };
  }

  const normalizedResult = stripNullFieldsRecursively(resultValue);
  if (!normalizedResult.changed) {
    return { value, changed: false };
  }

  return {
    value: {
      ...value,
      result: normalizedResult.value,
    },
    changed: true,
  };
}

export function normalizeMcpListToolsNullOptionals(value: unknown): {
  value: unknown;
  changed: boolean;
} {
  if (Array.isArray(value)) {
    let changed = false;
    const normalizedArray = value.map((entry) => {
      const normalized = normalizeMcpListToolsNullOptionals(entry);
      if (normalized.changed) {
        changed = true;
      }
      return normalized.value;
    });

    return changed
      ? { value: normalizedArray, changed: true }
      : { value, changed: false };
  }

  if (!isRecord(value)) {
    return { value, changed: false };
  }

  const resultValue = value.result;
  if (!isRecord(resultValue) || !Array.isArray(resultValue.tools)) {
    return { value, changed: false };
  }

  let changed = false;
  const normalizedTools = resultValue.tools.map((tool) => {
    if (!isRecord(tool)) {
      return tool;
    }

    const normalizedTool = stripNullFieldsRecursively(tool);
    if (normalizedTool.changed) {
      changed = true;
    }
    return normalizedTool.value;
  });

  if (!changed) {
    return { value, changed: false };
  }

  return {
    value: {
      ...value,
      result: {
        ...resultValue,
        tools: normalizedTools,
      },
    },
    changed: true,
  };
}

function looksLikeInitializeResult(value: Record<string, unknown>): boolean {
  const hasProtocolVersion = typeof value.protocolVersion === "string";
  const hasCapabilities = "capabilities" in value;
  const hasServerInfo = "serverInfo" in value;
  return hasProtocolVersion || (hasCapabilities && hasServerInfo);
}

function stripNullFieldsRecursively(value: unknown): {
  value: unknown;
  changed: boolean;
} {
  if (Array.isArray(value)) {
    let changed = false;
    const normalizedArray: unknown[] = [];
    for (const entry of value) {
      if (entry === null) {
        changed = true;
        continue;
      }

      const normalizedEntry = stripNullFieldsRecursively(entry);
      if (normalizedEntry.changed) {
        changed = true;
      }
      normalizedArray.push(normalizedEntry.value);
    }

    return changed
      ? { value: normalizedArray, changed: true }
      : { value, changed: false };
  }

  if (!isRecord(value)) {
    return { value, changed: false };
  }

  let changed = false;
  const normalizedObject: Record<string, unknown> = {};
  for (const [key, entryValue] of Object.entries(value)) {
    if (entryValue === null) {
      changed = true;
      continue;
    }

    const normalizedEntry = stripNullFieldsRecursively(entryValue);
    if (normalizedEntry.changed) {
      changed = true;
    }
    normalizedObject[key] = normalizedEntry.value;
  }

  return changed
    ? { value: normalizedObject, changed: true }
    : { value, changed: false };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}
