import { describe, expect, it } from "vitest";
import { MCP_DEFAULT_AZURE_AUTH_SCOPE, MCP_DEFAULT_TIMEOUT_SECONDS } from "~/lib/constants/mcp";
import { parseIncomingMcpServer } from "~/lib/contracts/mcp/server-config-parser";

describe("mcp-server-profile-service", () => {
  it("parses HTTP MCP server payload with defaults", () => {
    expect(
      parseIncomingMcpServer({
        transport: "streamable_http",
        url: "https://example.com/mcp",
      }),
    ).toEqual({
      ok: true,
      value: {
        name: "example.com",
        transport: "streamable_http",
        url: "https://example.com/mcp",
        headers: {},
        useAzureAuth: false,
        azureAuthScope: MCP_DEFAULT_AZURE_AUTH_SCOPE,
        timeoutSeconds: MCP_DEFAULT_TIMEOUT_SECONDS,
      },
    });
  });

  it("rejects reserved Content-Type header", () => {
    expect(
      parseIncomingMcpServer({
        transport: "streamable_http",
        url: "https://example.com/mcp",
        headers: {
          "Content-Type": "text/plain",
        },
      }),
    ).toEqual({
      ok: false,
      error: '`headers` must not include "Content-Type". It is fixed to "application/json".',
    });
  });
});
