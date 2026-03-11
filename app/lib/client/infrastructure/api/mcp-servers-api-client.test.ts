import { describe, expect, it, vi } from "vitest";
import { buildMcpServerConfigKey } from "~/lib/domain/value-objects/mcp-server-config-key";
import { McpServersApiClient } from "./mcp-servers-api-client";

function createWorkspaceMcpServerProfileResource() {
  return {
    id: "srv-1",
    userId: 10,
    profileOrder: 0,
    connectOnThreadCreate: false,
    configKey: buildMcpServerConfigKey({
      id: "srv-1",
      name: "filesystem",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
      env: {},
    }),
    name: "filesystem",
    transport: "stdio",
    url: null,
    headersJson: null,
    useAzureAuth: false,
    azureAuthScope: null,
    timeoutSeconds: null,
    command: "npx",
    argsJson: JSON.stringify(["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]),
    cwd: null,
    envJson: "{}",
  };
}

describe("McpServersApiClient", () => {
  it("loads saved profiles with GET", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("/api/mcp/servers");
      expect(init?.method).toBe("GET");

      return new Response(
        JSON.stringify({
          profiles: [createWorkspaceMcpServerProfileResource()],
        }),
        { status: 200 },
      );
    });

    const client = new McpServersApiClient();
    const result = await client.loadProfiles({ fetchImpl });

    expect(result.profiles).toHaveLength(1);
    expect(result.profiles[0]?.id).toBe("srv-1");
  });

  it("saves a profile and returns parsed warning", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("/api/mcp/servers");
      expect(init?.method).toBe("POST");

      return new Response(
        JSON.stringify({
          profile: createWorkspaceMcpServerProfileResource(),
          profiles: [],
          warning: "Duplicate configuration reused.",
        }),
        { status: 200 },
      );
    });

    const client = new McpServersApiClient();
    const result = await client.saveProfile(
      {
        id: "srv-1",
        name: "filesystem",
        transport: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
        env: {},
      },
      { fetchImpl },
    );

    expect(result.profile?.id).toBe("srv-1");
    expect(result.warning).toBe("Duplicate configuration reused.");
  });
});
