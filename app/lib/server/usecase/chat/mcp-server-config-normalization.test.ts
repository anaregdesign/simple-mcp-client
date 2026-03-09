import { describe, expect, it } from "vitest";
import { MCP_DEFAULT_AZURE_AUTH_SCOPE } from "~/lib/constants/mcp";
import {
  applyDefaultThreadDirectoryToStdioServers,
  buildMcpServerSessionConfigKey,
} from "~/lib/server/usecase/chat/mcp-server-config-normalization";

describe("applyDefaultThreadDirectoryToStdioServers", () => {
  it("applies thread workspace directory path only to stdio servers without explicit cwd", () => {
    const defaultPath = "/Users/hiroki/.foundry_local_playground/users/1/threads/thread-a";
    const result = applyDefaultThreadDirectoryToStdioServers(
      [
        {
          name: "local-stdio",
          transport: "stdio",
          command: "node",
          args: ["mcp.js"],
          env: {},
        },
        {
          name: "explicit-stdio",
          transport: "stdio",
          command: "node",
          args: ["mcp.js"],
          cwd: "/tmp/explicit",
          env: {},
        },
        {
          name: "http",
          transport: "streamable_http",
          url: "https://example.com/mcp",
          headers: {},
          useAzureAuth: false,
          azureAuthScope: MCP_DEFAULT_AZURE_AUTH_SCOPE,
          timeoutSeconds: 30,
        },
      ],
      defaultPath,
      "/Users/hiroki/.foundry_local_playground/users/1",
    );

    expect(result).toEqual([
      {
        name: "local-stdio",
        transport: "stdio",
        command: "node",
        args: ["mcp.js"],
        cwd: defaultPath,
        env: {},
      },
      {
        name: "explicit-stdio",
        transport: "stdio",
        command: "node",
        args: ["mcp.js"],
        cwd: "/tmp/explicit",
        env: {},
      },
      {
        name: "http",
        transport: "streamable_http",
        url: "https://example.com/mcp",
        headers: {},
        useAzureAuth: false,
        azureAuthScope: MCP_DEFAULT_AZURE_AUTH_SCOPE,
        timeoutSeconds: 30,
      },
    ]);
  });

  it("de-duplicates equivalent stdio servers after default cwd is applied", () => {
    const defaultPath = "/Users/hiroki/.foundry_local_playground/users/1/threads/thread-a";
    const result = applyDefaultThreadDirectoryToStdioServers(
      [
        {
          name: "server-a",
          transport: "stdio",
          command: "node",
          args: ["mcp.js"],
          env: {},
        },
        {
          name: "server-b",
          transport: "stdio",
          command: "node",
          args: ["mcp.js"],
          cwd: defaultPath,
          env: {},
        },
      ],
      defaultPath,
      "/Users/hiroki/.foundry_local_playground/users/1",
    );

    expect(result).toEqual([
      {
        name: "server-a",
        transport: "stdio",
        command: "node",
        args: ["mcp.js"],
        cwd: defaultPath,
        env: {},
      },
    ]);
  });
});

describe("buildMcpServerSessionConfigKey", () => {
  it("builds stable keys for equivalent HTTP server configs", () => {
    const first = buildMcpServerSessionConfigKey({
      name: "A",
      transport: "streamable_http",
      url: "https://EXAMPLE.com/mcp",
      headers: {
        "X-Trace": "abc",
      },
      useAzureAuth: true,
      azureAuthScope: "https://SCOPE/.default",
      timeoutSeconds: 30,
    });
    const second = buildMcpServerSessionConfigKey({
      name: "B",
      transport: "streamable_http",
      url: "https://example.com/mcp",
      headers: {
        "x-trace": "abc",
      },
      useAzureAuth: true,
      azureAuthScope: "https://scope/.default",
      timeoutSeconds: 30,
    });

    expect(first).toBe(second);
  });

  it("includes stdio command details in keys", () => {
    const first = buildMcpServerSessionConfigKey({
      name: "filesystem-a",
      transport: "stdio",
      command: "NPX",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "."],
      cwd: "/tmp/project",
      env: { A: "1" },
    });
    const second = buildMcpServerSessionConfigKey({
      name: "filesystem-b",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "."],
      cwd: "/tmp/project",
      env: { A: "2" },
    });

    expect(first).not.toBe(second);
  });
});
