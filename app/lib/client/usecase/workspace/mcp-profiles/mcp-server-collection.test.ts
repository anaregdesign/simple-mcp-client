import { describe, expect, it } from "vitest";
import { MCP_DEFAULT_AZURE_AUTH_SCOPE, MCP_DEFAULT_TIMEOUT_SECONDS } from "~/lib/constants/mcp";
import { upsertMcpServer } from "~/lib/client/usecase/workspace/mcp-profiles/mcp-server-collection";

describe("mcp-server-collection", () => {
  it("upserts profiles by id", () => {
    const current = [
      {
        id: "server-1",
        name: "Server 1",
        transport: "sse" as const,
        url: "https://example.com/mcp",
        headers: {},
        useAzureAuth: false,
        azureAuthScope: MCP_DEFAULT_AZURE_AUTH_SCOPE,
        timeoutSeconds: MCP_DEFAULT_TIMEOUT_SECONDS,
      },
    ];

    const updated = upsertMcpServer(current, {
      id: "server-1",
      name: "Server 1 Updated",
      transport: "sse",
      url: "https://example.com/mcp",
      headers: {},
      useAzureAuth: false,
      azureAuthScope: MCP_DEFAULT_AZURE_AUTH_SCOPE,
      timeoutSeconds: MCP_DEFAULT_TIMEOUT_SECONDS,
    });
    const appended = upsertMcpServer(updated, {
      id: "server-2",
      name: "Server 2",
      transport: "sse",
      url: "https://example.com/mcp-2",
      headers: {},
      useAzureAuth: false,
      azureAuthScope: MCP_DEFAULT_AZURE_AUTH_SCOPE,
      timeoutSeconds: MCP_DEFAULT_TIMEOUT_SECONDS,
    });

    expect(updated[0]?.name).toBe("Server 1 Updated");
    expect(appended).toHaveLength(2);
  });
});
