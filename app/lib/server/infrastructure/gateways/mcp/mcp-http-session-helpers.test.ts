import { describe, expect, it } from "vitest";
import {
  MCP_DEFAULT_AZURE_AUTH_SCOPE,
  MCP_LOCAL_PLAYGROUND_CLIENT_PLATFORM_HEADER,
  MCP_LOCAL_PLAYGROUND_CLIENT_USER_AGENT_HEADER,
  MCP_LOCAL_PLAYGROUND_THREAD_ID_HEADER,
  MCP_LOCAL_PLAYGROUND_TURN_ID_HEADER,
} from "~/lib/constants/mcp";
import {
  buildMcpContextRequestHeaders,
  buildMcpHttpRequestHeaders,
  buildMcpHttpRuntimeHeaders,
  isLocalPlaygroundMcpContextUrl,
  normalizeMcpInitializeNullOptionals,
  normalizeMcpListToolsNullOptionals,
  normalizeMcpMetaNulls,
} from "~/lib/server/infrastructure/gateways/mcp/mcp-http-session-helpers";

describe("buildMcpHttpRequestHeaders", () => {
  it("merges defaults and drops content-type overrides", () => {
    expect(
      buildMcpHttpRequestHeaders({
        "x-test": "ok",
        "Content-Type": "application/json",
      }),
    ).toMatchObject({
      "Content-Type": "application/json",
      "x-test": "ok",
    });
    expect(buildMcpHttpRequestHeaders({ "Content-Type": "application/json" })).toHaveProperty(
      "Content-Type",
      "application/json",
    );
  });
});

describe("buildMcpContextRequestHeaders", () => {
  it("attaches local playground context headers for local /mcp/cmd servers", () => {
    expect(
      buildMcpContextRequestHeaders(
        {
          name: "local",
          transport: "streamable_http",
          url: "http://localhost:3000/mcp/cmd",
          headers: {},
          useAzureAuth: false,
          azureAuthScope: MCP_DEFAULT_AZURE_AUTH_SCOPE,
          timeoutSeconds: 30,
        },
        {
          threadId: "thread-1",
          turnId: "turn-1",
          clientUserAgent: "codex",
          clientPlatform: "macOS",
        },
      ),
    ).toEqual({
      [MCP_LOCAL_PLAYGROUND_THREAD_ID_HEADER]: "thread-1",
      [MCP_LOCAL_PLAYGROUND_TURN_ID_HEADER]: "turn-1",
      [MCP_LOCAL_PLAYGROUND_CLIENT_USER_AGENT_HEADER]: "codex",
      [MCP_LOCAL_PLAYGROUND_CLIENT_PLATFORM_HEADER]: "macOS",
    });
  });
});

describe("buildMcpHttpRuntimeHeaders", () => {
  it("adds Azure auth and local request context headers", async () => {
    const headers = await buildMcpHttpRuntimeHeaders(
      {
        name: "local",
        transport: "streamable_http",
        url: "http://localhost:3000/mcp/cmd",
        headers: {
          "x-test": "ok",
        },
        useAzureAuth: true,
        azureAuthScope: "https://example/.default",
        timeoutSeconds: 30,
      },
      {
        requestContext: {
          threadId: "thread-1",
          turnId: "turn-1",
          clientUserAgent: "codex",
          clientPlatform: "macOS",
        },
        getAzureAuthorizationToken: async (scope) => `token:${scope}`,
      },
    );

    expect(headers).toMatchObject({
      "Content-Type": "application/json",
      "x-test": "ok",
      Authorization: "Bearer token:https://example/.default",
      [MCP_LOCAL_PLAYGROUND_THREAD_ID_HEADER]: "thread-1",
    });
  });
});

describe("MCP payload normalizers", () => {
  it("normalizes nested _meta nulls", () => {
    expect(
      normalizeMcpMetaNulls({
        _meta: null,
        tools: [{ _meta: null }],
      }),
    ).toEqual({
      changed: true,
      value: {
        _meta: {},
        tools: [{ _meta: {} }],
      },
    });
  });

  it("removes null optionals from initialize and tools payloads", () => {
    expect(
      normalizeMcpInitializeNullOptionals({
        result: {
          protocolVersion: "2025-01-01",
          capabilities: {
            tools: null,
            prompts: {},
          },
          serverInfo: {
            name: "demo",
            title: null,
          },
        },
      }),
    ).toEqual({
      changed: true,
      value: {
        result: {
          protocolVersion: "2025-01-01",
          capabilities: {
            prompts: {},
          },
          serverInfo: {
            name: "demo",
          },
        },
      },
    });

    expect(
      normalizeMcpListToolsNullOptionals({
        result: {
          tools: [
            {
              name: "search",
              description: null,
              inputSchema: {
                type: "object",
                properties: null,
              },
            },
          ],
        },
      }),
    ).toEqual({
      changed: true,
      value: {
        result: {
          tools: [
            {
              name: "search",
              inputSchema: {
                type: "object",
              },
            },
          ],
        },
      },
    });
  });
});

describe("isLocalPlaygroundMcpContextUrl", () => {
  it("accepts local /mcp/cmd URLs and rejects others", () => {
    expect(isLocalPlaygroundMcpContextUrl("/mcp/cmd")).toBe(true);
    expect(isLocalPlaygroundMcpContextUrl("http://127.0.0.1:3000/mcp/cmd/")).toBe(true);
    expect(isLocalPlaygroundMcpContextUrl("/mcp/debug")).toBe(false);
    expect(isLocalPlaygroundMcpContextUrl("https://example.com/mcp/cmd")).toBe(false);
  });
});
