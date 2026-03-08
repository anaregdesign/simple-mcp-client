import { describe, expect, it } from "vitest";
import { MCP_AZURE_AUTH_SCOPE_MAX_LENGTH, MCP_DEFAULT_AZURE_AUTH_SCOPE, MCP_HTTP_HEADERS_MAX, MCP_TIMEOUT_SECONDS_MIN } from "~/lib/constants/mcp";
import {
  isMcpHeaderCountWithinLimit,
  normalizeAndValidateMcpAzureAuthScope,
  validateMcpHeaderKey,
  validateMcpTimeoutSeconds,
} from "./validation";

describe("validateMcpHeaderKey", () => {
  it("accepts valid header keys", () => {
    expect(validateMcpHeaderKey("X-Trace-Id")).toEqual({ ok: true });
  });

  it("rejects malformed header keys", () => {
    expect(validateMcpHeaderKey("X Trace")).toEqual({ ok: false, reason: "invalid_key" });
  });

  it("rejects reserved Content-Type header", () => {
    expect(validateMcpHeaderKey("Content-Type")).toEqual({
      ok: false,
      reason: "reserved_content_type",
    });
  });
});

describe("isMcpHeaderCountWithinLimit", () => {
  it("returns true at the limit", () => {
    expect(isMcpHeaderCountWithinLimit(MCP_HTTP_HEADERS_MAX)).toBe(true);
  });

  it("returns false when count exceeds the limit", () => {
    expect(isMcpHeaderCountWithinLimit(MCP_HTTP_HEADERS_MAX + 1)).toBe(false);
  });
});

describe("normalizeAndValidateMcpAzureAuthScope", () => {
  it("falls back to default scope for empty input", () => {
    expect(normalizeAndValidateMcpAzureAuthScope("   ")).toEqual({
      ok: true,
      value: MCP_DEFAULT_AZURE_AUTH_SCOPE,
    });
  });

  it("rejects whitespace in scope", () => {
    expect(normalizeAndValidateMcpAzureAuthScope("scope with spaces")).toEqual({
      ok: false,
      reason: "contains_spaces",
    });
  });

  it("rejects scopes over the maximum length", () => {
    expect(
      normalizeAndValidateMcpAzureAuthScope(
        `https://${"x".repeat(MCP_AZURE_AUTH_SCOPE_MAX_LENGTH)}`,
      ),
    ).toEqual({
      ok: false,
      reason: "too_long",
    });
  });
});

describe("validateMcpTimeoutSeconds", () => {
  it("accepts in-range integers", () => {
    expect(validateMcpTimeoutSeconds(MCP_TIMEOUT_SECONDS_MIN)).toEqual({
      ok: true,
      value: MCP_TIMEOUT_SECONDS_MIN,
    });
  });

  it("rejects non-integer values", () => {
    expect(validateMcpTimeoutSeconds(1.5)).toEqual({ ok: false, reason: "not_integer" });
  });

  it("rejects out-of-range values", () => {
    expect(validateMcpTimeoutSeconds(0)).toEqual({ ok: false, reason: "out_of_range" });
  });
});
