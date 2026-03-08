/**
 * Shared MCP validation helpers for frontend and backend.
 */
import { HTTP_HEADER_NAME_PATTERN, MCP_AZURE_AUTH_SCOPE_MAX_LENGTH, MCP_DEFAULT_AZURE_AUTH_SCOPE, MCP_HTTP_HEADERS_MAX, MCP_TIMEOUT_SECONDS_MAX, MCP_TIMEOUT_SECONDS_MIN } from "~/lib/constants/mcp";

export type McpHeaderKeyValidationResult =
  | { ok: true }
  | { ok: false; reason: "invalid_key" | "reserved_content_type" };

export type McpTimeoutValidationResult =
  | { ok: true; value: number }
  | { ok: false; reason: "not_integer" | "out_of_range" };

export type McpAzureAuthScopeValidationResult =
  | { ok: true; value: string }
  | { ok: false; reason: "too_long" | "contains_spaces" };

export function validateMcpHeaderKey(key: string): McpHeaderKeyValidationResult {
  if (!HTTP_HEADER_NAME_PATTERN.test(key)) {
    return { ok: false, reason: "invalid_key" };
  }

  if (key.toLowerCase() === "content-type") {
    return { ok: false, reason: "reserved_content_type" };
  }

  return { ok: true };
}

export function isMcpHeaderCountWithinLimit(count: number): boolean {
  return count <= MCP_HTTP_HEADERS_MAX;
}

export function normalizeAndValidateMcpAzureAuthScope(
  rawScope: string,
): McpAzureAuthScopeValidationResult {
  const scope = rawScope.trim() || MCP_DEFAULT_AZURE_AUTH_SCOPE;
  if (scope.length > MCP_AZURE_AUTH_SCOPE_MAX_LENGTH) {
    return { ok: false, reason: "too_long" };
  }

  if (/\s/.test(scope)) {
    return { ok: false, reason: "contains_spaces" };
  }

  return { ok: true, value: scope };
}

export function validateMcpTimeoutSeconds(rawTimeout: number): McpTimeoutValidationResult {
  if (!Number.isSafeInteger(rawTimeout)) {
    return { ok: false, reason: "not_integer" };
  }

  if (rawTimeout < MCP_TIMEOUT_SECONDS_MIN || rawTimeout > MCP_TIMEOUT_SECONDS_MAX) {
    return { ok: false, reason: "out_of_range" };
  }

  return { ok: true, value: rawTimeout };
}
