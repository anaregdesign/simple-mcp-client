/**
 * Test module verifying api.mcp.servers collection route behavior.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  readAzureArmUserContext,
  getOrCreateUserByIdentity,
  createMcpServerProfileService,
  ensureDefaultMcpServersForUser,
  readWorkspaceMcpServerProfiles,
  writeWorkspaceMcpServerProfiles,
  logServerRouteEvent,
} = vi.hoisted(() => ({
  readAzureArmUserContext: vi.fn(async () => ({
    tenantId: "tenant-a",
    principalId: "principal-a",
  })),
  getOrCreateUserByIdentity: vi.fn(async () => ({
    id: 1,
    tenantId: "tenant-a",
    principalId: "principal-a",
  })),
  createMcpServerProfileService: vi.fn(),
  ensureDefaultMcpServersForUser: vi.fn(async () => undefined),
  readWorkspaceMcpServerProfiles: vi.fn(async () => []),
  writeWorkspaceMcpServerProfiles: vi.fn(async () => undefined),
  logServerRouteEvent: vi.fn(async () => undefined),
}));

vi.mock("~/lib/server/infrastructure/auth/azure-arm-user-context", () => ({
  readAzureArmUserContext,
}));

vi.mock("~/lib/server/infrastructure/persistence/user", () => ({
  getOrCreateUserByIdentity,
}));

vi.mock("~/lib/server/usecase/mcp/mcp-server-profile-service", async () => {
  const actual = await vi.importActual<
    typeof import("~/lib/server/usecase/mcp/mcp-server-profile-service")
  >("~/lib/server/usecase/mcp/mcp-server-profile-service");

  return {
    ...actual,
    createMcpServerProfileService: createMcpServerProfileService.mockReturnValue(
      {
        ensureDefaultMcpServersForUser,
        readWorkspaceMcpServerProfiles,
        writeWorkspaceMcpServerProfiles,
      },
    ),
  };
});

vi.mock("~/lib/server/observability/runtime-event-log", () => ({
  installGlobalServerErrorLogging: vi.fn(),
  logServerRouteEvent,
}));

import { action, loader } from "./api.mcp.servers";

describe("/api/mcp/servers collection", () => {
  beforeEach(() => {
    readAzureArmUserContext.mockReset();
    readAzureArmUserContext.mockResolvedValue({
      tenantId: "tenant-a",
      principalId: "principal-a",
    });
    getOrCreateUserByIdentity.mockReset();
    getOrCreateUserByIdentity.mockResolvedValue({
      id: 1,
      tenantId: "tenant-a",
      principalId: "principal-a",
    });
    createMcpServerProfileService.mockClear();
    ensureDefaultMcpServersForUser.mockReset();
    ensureDefaultMcpServersForUser.mockResolvedValue(undefined);
    readWorkspaceMcpServerProfiles.mockReset();
    readWorkspaceMcpServerProfiles.mockResolvedValue([]);
    writeWorkspaceMcpServerProfiles.mockReset();
    writeWorkspaceMcpServerProfiles.mockResolvedValue(undefined);
    logServerRouteEvent.mockReset();
    logServerRouteEvent.mockResolvedValue(undefined);
  });

  it("returns 200 for GET and ensures default profiles", async () => {
    const response = await loader({
      request: new Request("http://localhost/api/mcp/servers", { method: "GET" }),
    } as never);

    expect(response.status).toBe(200);
    expect(createMcpServerProfileService).toHaveBeenCalledTimes(1);
    expect(ensureDefaultMcpServersForUser).toHaveBeenCalledTimes(1);
    expect(readWorkspaceMcpServerProfiles).toHaveBeenCalledTimes(1);
  });

  it("returns 405 with Allow for unsupported loader methods", async () => {
    const response = await loader({
      request: new Request("http://localhost/api/mcp/servers", { method: "DELETE" }),
    } as never);

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, POST");
  });

  it("returns 405 with Allow for unsupported action methods", async () => {
    const response = await action({
      request: new Request("http://localhost/api/mcp/servers", { method: "PUT" }),
    } as never);

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, POST");
  });
});
