/**
 * Tests for shared MCP server config parser.
 */
import { describe, expect, it } from "vitest";
import { MCP_DEFAULT_AZURE_AUTH_SCOPE, MCP_DEFAULT_TIMEOUT_SECONDS } from "~/lib/constants/mcp";
import {
  parseChatMcpServerEntry,
  parseIncomingMcpServer,
} from "~/lib/contracts/mcp/server-config-parser";

describe("parseIncomingMcpServer", () => {
  it("parses stdio payloads", () => {
    const result = parseIncomingMcpServer({
      name: "stdio server",
      transport: "stdio",
      command: "node",
      args: ["server.js"],
      env: {
        TOKEN: "value",
      },
      connectOnThreadCreate: true,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        name: "stdio server",
        transport: "stdio",
        command: "node",
        args: ["server.js"],
        env: {
          TOKEN: "value",
        },
        connectOnThreadCreate: true,
      },
    });
  });

  it("keeps workspace-style validation messages", () => {
    const result = parseIncomingMcpServer({
      name: "http server",
      transport: "streamable_http",
      url: "https://example.test/mcp",
      timeoutSeconds: "10",
    });

    expect(result).toEqual({
      ok: false,
      error: "`timeoutSeconds` must be an integer.",
    });
  });
});

describe("parseChatMcpServerEntry", () => {
  it("parses and resolves relative URLs for chat payload entries", () => {
    const result = parseChatMcpServerEntry(
      {
        name: "local debug",
        transport: "streamable_http",
        url: "/mcp/debug",
      },
      {
        index: 2,
        requestUrl: "https://playground.test/api/chat",
      },
    );

    expect(result).toEqual({
      ok: true,
      value: {
        name: "local debug",
        transport: "streamable_http",
        url: "https://playground.test/mcp/debug",
        headers: {},
        useAzureAuth: false,
        azureAuthScope: MCP_DEFAULT_AZURE_AUTH_SCOPE,
        timeoutSeconds: MCP_DEFAULT_TIMEOUT_SECONDS,
      },
    });
  });

  it("keeps chat-style field-prefixed validation messages", () => {
    const result = parseChatMcpServerEntry(
      {
        transport: "sse",
        url: "https://example.test/sse",
        timeoutSeconds: "10",
      },
      {
        index: 1,
      },
    );

    expect(result).toEqual({
      ok: false,
      error: "mcpServers[1].timeoutSeconds must be an integer.",
    });
  });
});
