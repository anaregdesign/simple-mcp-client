/**
 * Home runtime support module.
 */
export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

import {
  MCP_AZURE_AUTH_SCOPE_MAX_LENGTH,
  MCP_DEFAULT_TIMEOUT_SECONDS,
  MCP_HTTP_HEADERS_MAX,
  MCP_TIMEOUT_SECONDS_MAX,
  MCP_TIMEOUT_SECONDS_MIN,
} from "~/lib/constants";
import {
  isMcpHeaderCountWithinLimit,
  normalizeAndValidateMcpAzureAuthScope,
  validateMcpHeaderKey,
  validateMcpTimeoutSeconds,
} from "~/lib/mcp/validation";

export function parseHttpHeadersInput(input: string): ParseResult<Record<string, string>> {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: true, value: {} };
  }

  const headers: Record<string, string> = {};
  const lines = input.split(/\r?\n/);
  let count = 0;

  for (const [index, line] of lines.entries()) {
    const lineTrimmed = line.trim();
    if (!lineTrimmed) {
      continue;
    }

    const separatorIndex = lineTrimmed.indexOf("=");
    if (separatorIndex <= 0) {
      return {
        ok: false,
        error: `Header line ${index + 1} must use KEY=value format.`,
      };
    }

    const key = lineTrimmed.slice(0, separatorIndex).trim();
    const value = lineTrimmed.slice(separatorIndex + 1).trim();
    const headerKeyValidation = validateMcpHeaderKey(key);
    if (!headerKeyValidation.ok && headerKeyValidation.reason === "invalid_key") {
      return {
        ok: false,
        error: `Header line ${index + 1} has invalid key.`,
      };
    }

    if (!headerKeyValidation.ok && headerKeyValidation.reason === "reserved_content_type") {
      return {
        ok: false,
        error: 'Header line cannot override "Content-Type". It is fixed to "application/json".',
      };
    }

    headers[key] = value;
    count += 1;
    if (!isMcpHeaderCountWithinLimit(count)) {
      return {
        ok: false,
        error: `Headers can include up to ${MCP_HTTP_HEADERS_MAX} entries.`,
      };
    }
  }

  return { ok: true, value: headers };
}

export function parseAzureAuthScopeInput(input: string): ParseResult<string> {
  const scopeValidation = normalizeAndValidateMcpAzureAuthScope(input);
  if (!scopeValidation.ok) {
    if (scopeValidation.reason === "too_long") {
      return {
        ok: false,
        error: `Azure auth scope must be ${MCP_AZURE_AUTH_SCOPE_MAX_LENGTH} characters or fewer.`,
      };
    }

    return {
      ok: false,
      error: "Azure auth scope must not include spaces.",
    };
  }

  return { ok: true, value: scopeValidation.value };
}

export function parseMcpTimeoutSecondsInput(input: string): ParseResult<number> {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: true, value: MCP_DEFAULT_TIMEOUT_SECONDS };
  }

  const parsed = Number(trimmed);
  const timeoutValidation = validateMcpTimeoutSeconds(parsed);
  if (!timeoutValidation.ok) {
    if (timeoutValidation.reason === "not_integer") {
      return {
        ok: false,
        error: "MCP timeout must be an integer number of seconds.",
      };
    }

    return {
      ok: false,
      error: `MCP timeout must be between ${MCP_TIMEOUT_SECONDS_MIN} and ${MCP_TIMEOUT_SECONDS_MAX} seconds.`,
    };
  }

  return { ok: true, value: timeoutValidation.value };
}
