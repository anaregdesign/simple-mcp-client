import { describe, expect, it } from "vitest";
import { ThreadMcpConnection } from "~/lib/domain/threads/thread-mcp-connection";

describe("ThreadMcpConnection", () => {
  it("keeps HTTP transport settings", () => {
    const connection = new ThreadMcpConnection({
      id: "server-1",
      name: "openai-docs",
      transport: "streamable_http",
      url: "https://developers.openai.com/mcp",
      headers: {},
      useAzureAuth: false,
      azureAuthScope: "https://example/.default",
      timeoutSeconds: 30,
    });

    expect(connection.transport).toBe("streamable_http");
    expect(connection.isStdio()).toBe(false);
    expect(connection.toSnapshot()).toMatchObject({
      id: "server-1",
      transport: "streamable_http",
    });
  });

  it("rejects empty ids", () => {
    expect(
      () =>
        new ThreadMcpConnection({
          id: " ",
          name: "filesystem",
          transport: "stdio",
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-filesystem", "."],
          env: {},
        }),
    ).toThrow("ThreadMcpConnection id is required.");
  });
});
