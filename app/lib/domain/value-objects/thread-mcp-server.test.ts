import { describe, expect, it } from "vitest";
import {
  cloneThreadMcpServer,
  cloneThreadMcpServers,
} from "~/lib/domain/value-objects/thread-mcp-server";

describe("thread-mcp-server", () => {
  it("clones stdio servers defensively", () => {
    const server = {
      id: "server-a",
      threadId: "thread-a",
      selectionOrder: 0,
      name: "Server A",
      transport: "stdio" as const,
      command: "node",
      args: ["mcp.js"],
      cwd: "/tmp",
      env: {
        PATH: "/usr/bin",
      },
    };

    const cloned = cloneThreadMcpServer(server);
    if (cloned.transport !== "stdio") {
      throw new Error("Expected stdio server.");
    }

    cloned.args[0] = "updated.js";
    cloned.env.PATH = "/custom/bin";

    expect(server.args[0]).toBe("mcp.js");
    expect(server.env.PATH).toBe("/usr/bin");
  });

  it("clones http servers and collections defensively", () => {
    const server = {
      id: "server-b",
      threadId: "thread-a",
      selectionOrder: 1,
      name: "Server B",
      transport: "streamable_http" as const,
      url: "https://example.com/mcp",
      headers: {
        Authorization: "Bearer token",
      },
      useAzureAuth: true,
      azureAuthScope: "https://scope/.default",
      timeoutSeconds: 30,
    };

    const cloned = cloneThreadMcpServer(server);
    if (cloned.transport === "stdio") {
      throw new Error("Expected http server.");
    }

    cloned.headers.Authorization = "Bearer updated";

    expect(server.headers.Authorization).toBe("Bearer token");
    expect(cloneThreadMcpServers([server])[0]).not.toBe(server);
  });
});
