/**
 * Test module verifying api.mcp.servers.$serverId behavior.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  readAuthenticatedUser,
  createMcpServerProfileService,
  readWorkspaceMcpServerProfiles,
  deleteWorkspaceMcpServerProfile,
  writeWorkspaceMcpServerProfiles,
  parseIncomingMcpServer,
  mergeDefaultWorkspaceMcpServerProfiles,
  upsertWorkspaceMcpServerProfile,
  logServerRouteEvent,
} = vi.hoisted(() => ({
  readAuthenticatedUser: vi.fn(async () => ({ id: 1 })),
  createMcpServerProfileService: vi.fn(),
  readWorkspaceMcpServerProfiles: vi.fn(async () => []),
  deleteWorkspaceMcpServerProfile: vi.fn(() => ({ profiles: [], deleted: false })),
  writeWorkspaceMcpServerProfiles: vi.fn(async () => undefined),
  parseIncomingMcpServer: vi.fn<any>(() => ({
    ok: true as const,
    value: {
      name: "Server",
      transport: "stdio",
      command: "node",
      args: ["server.js"],
      env: {},
    },
  })),
  mergeDefaultWorkspaceMcpServerProfiles: vi.fn((profiles: unknown) => profiles),
  upsertWorkspaceMcpServerProfile: vi.fn<any>(() => ({
    profile: { id: "srv-1" },
    profiles: [],
    warning: null,
  })),
  logServerRouteEvent: vi.fn(async () => undefined),
}));

vi.mock("~/lib/server/infrastructure/auth/read-authenticated-user", () => ({
  readAuthenticatedUser,
}));

vi.mock("~/lib/server/usecase/mcp/mcp-server-profile-service", () => ({
  createMcpServerProfileService: createMcpServerProfileService.mockReturnValue({
    readWorkspaceMcpServerProfiles,
    writeWorkspaceMcpServerProfiles,
  }),
  deleteWorkspaceMcpServerProfile,
  parseIncomingMcpServer,
  mergeDefaultWorkspaceMcpServerProfiles,
  upsertWorkspaceMcpServerProfile,
}));

vi.mock("~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway", () => ({
  installGlobalServerErrorLogging: vi.fn(),
  logServerRouteEvent,
}));

import { action, loader } from "./api.mcp.servers.$serverId";

describe("/api/mcp/servers/:serverId", () => {
  beforeEach(() => {
    readAuthenticatedUser.mockReset();
    readAuthenticatedUser.mockResolvedValue({ id: 1 });
    createMcpServerProfileService.mockClear();
    readWorkspaceMcpServerProfiles.mockReset();
    readWorkspaceMcpServerProfiles.mockResolvedValue([]);
    deleteWorkspaceMcpServerProfile.mockReset();
    deleteWorkspaceMcpServerProfile.mockReturnValue({ profiles: [], deleted: false });
    writeWorkspaceMcpServerProfiles.mockReset();
    writeWorkspaceMcpServerProfiles.mockResolvedValue(undefined);
    parseIncomingMcpServer.mockReset();
    parseIncomingMcpServer.mockReturnValue({
      ok: true,
      value: {
        name: "Server",
        transport: "stdio",
        command: "node",
        args: ["server.js"],
        env: {},
      },
    });
    mergeDefaultWorkspaceMcpServerProfiles.mockReset();
    mergeDefaultWorkspaceMcpServerProfiles.mockImplementation((profiles: unknown) => profiles);
    upsertWorkspaceMcpServerProfile.mockReset();
    upsertWorkspaceMcpServerProfile.mockReturnValue({
      profile: {
        id: "srv-1",
        name: "Server",
        transport: "stdio",
        command: "node",
        args: ["server.js"],
        env: {},
      },
      profiles: [],
      warning: null,
    });
    logServerRouteEvent.mockReset();
    logServerRouteEvent.mockResolvedValue(undefined);
  });

  it("returns 405 response with Allow header for loader", async () => {
    const response = loader();
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("PUT, DELETE");
  });

  it("returns 405 for unsupported methods", async () => {
    const response = await action({
      request: new Request("http://localhost/api/mcp/servers/srv-1", { method: "POST" }),
      params: { serverId: "srv-1" },
    } as never);

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("PUT, DELETE");
  });

  it("returns 404 when deleting unknown server", async () => {
    deleteWorkspaceMcpServerProfile.mockReturnValueOnce({ profiles: [], deleted: false });

    const response = await action({
      request: new Request("http://localhost/api/mcp/servers/srv-404", { method: "DELETE" }),
      params: { serverId: "srv-404" },
    } as never);
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(404);
    expect(payload.error).toBe("Selected MCP server is not available.");
  });

  it("returns 422 when PUT payload id conflicts with path id", async () => {
    parseIncomingMcpServer.mockReturnValueOnce({
      ok: true,
      value: {
        id: "srv-other",
        name: "Server",
        transport: "stdio",
        command: "node",
        args: ["server.js"],
        env: {},
      },
    });

    const response = await action({
      request: new Request("http://localhost/api/mcp/servers/srv-1", {
        method: "PUT",
        body: JSON.stringify({
          transport: "stdio",
          command: "node",
          args: ["server.js"],
        }),
      }),
      params: { serverId: "srv-1" },
    } as never);
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(422);
    expect(payload.error).toBe("`id` must match path `serverId`.");
  });
});
