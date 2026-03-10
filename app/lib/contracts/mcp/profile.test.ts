/**
 * Test module verifying profile behavior.
 */
import { describe, expect, it } from "vitest";
import { MCP_DEFAULT_AZURE_AUTH_SCOPE, MCP_DEFAULT_TIMEOUT_SECONDS } from "~/lib/constants/mcp";
import {
  readMcpServerFromUnknown,
  readMcpServerList,
  serializeMcpServerForSave,
} from "./profile";

describe("readMcpServerFromUnknown / readMcpServerList", () => {
  it("reads stdio server and sanitizes args/env/cwd", () => {
    const server = readMcpServerFromUnknown({
      id: " stdio-1 ",
      name: " Local FS ",
      transport: "stdio",
      command: " npx ",
      args: [" --yes ", " ", "@mcp/server"],
      cwd: " /tmp/work ",
      env: {
        API_KEY: "abc",
        "invalid-key": "ignored",
      },
    });

    expect(server).toEqual({
      id: "stdio-1",
      name: "Local FS",
      connectOnThreadCreate: false,
      transport: "stdio",
      command: "npx",
      args: ["--yes", "@mcp/server"],
      cwd: "/tmp/work",
      env: {
        API_KEY: "abc",
      },
    });
  });

  it("reads HTTP server and applies defaults", () => {
    const server = readMcpServerFromUnknown({
      id: "http-1",
      name: "HTTP",
      transport: "streamable_http",
      url: "https://example.com/mcp",
      headers: {
        Authorization: "Bearer token",
        "Content-Type": "text/plain",
      },
      useAzureAuth: true,
      azureAuthScope: "scope with spaces",
      timeoutSeconds: 9999,
    });

    expect(server).toEqual({
      id: "http-1",
      name: "HTTP",
      connectOnThreadCreate: false,
      transport: "streamable_http",
      url: "https://example.com/mcp",
      headers: {
        Authorization: "Bearer token",
      },
      useAzureAuth: true,
      azureAuthScope: MCP_DEFAULT_AZURE_AUTH_SCOPE,
      timeoutSeconds: MCP_DEFAULT_TIMEOUT_SECONDS,
    });
  });

  it("returns null for invalid payload", () => {
    expect(readMcpServerFromUnknown({ id: "", name: "x" })).toBeNull();
    expect(
      readMcpServerFromUnknown({
        id: "x",
        name: "x",
        transport: "stdio",
        command: "node",
        args: ["a"],
        env: {
          A: 1,
        },
      }),
    ).toBeNull();
  });

  it("filters invalid entries from list", () => {
    const list = readMcpServerList([
      { id: "ok", name: "ok", transport: "sse", url: "https://example.com", headers: {} },
      { id: "bad", transport: "sse" },
      "invalid",
    ]);

    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("ok");
  });
});

describe("MCP profile helpers", () => {
  it("serializes server payload for save without id", () => {
    const stdioPayload = serializeMcpServerForSave({
      id: "stdio-1",
      name: "Local",
      transport: "stdio",
      command: "node",
      args: ["server.js"],
      cwd: "/tmp",
      env: { MODE: "dev" },
    });

    expect(stdioPayload).toEqual({
      name: "Local",
      transport: "stdio",
      command: "node",
      args: ["server.js"],
      cwd: "/tmp",
      env: { MODE: "dev" },
    });
  });

  it("includes id when requested for edit flow", () => {
    const payload = serializeMcpServerForSave(
      {
        id: "http-1",
        name: "Remote",
        transport: "streamable_http",
        url: "https://example.com/mcp",
        headers: {},
        useAzureAuth: false,
        azureAuthScope: MCP_DEFAULT_AZURE_AUTH_SCOPE,
        timeoutSeconds: MCP_DEFAULT_TIMEOUT_SECONDS,
      },
      { includeId: true },
    );

    expect(payload).toEqual({
      id: "http-1",
      name: "Remote",
      transport: "streamable_http",
      url: "https://example.com/mcp",
      headers: {},
      useAzureAuth: false,
      azureAuthScope: MCP_DEFAULT_AZURE_AUTH_SCOPE,
      timeoutSeconds: MCP_DEFAULT_TIMEOUT_SECONDS,
    });
  });
});
