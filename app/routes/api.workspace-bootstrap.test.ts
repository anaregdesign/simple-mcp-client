import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  readAuthenticatedWorkspaceUserMock,
  loadWorkspaceBootstrapMock,
  createWorkspaceBootstrapServiceMock,
  installGlobalServerErrorLoggingMock,
  logServerRouteEventMock,
} = vi.hoisted(() => ({
  readAuthenticatedWorkspaceUserMock: vi.fn(),
  loadWorkspaceBootstrapMock: vi.fn(),
  createWorkspaceBootstrapServiceMock: vi.fn(),
  installGlobalServerErrorLoggingMock: vi.fn(),
  logServerRouteEventMock: vi.fn(),
}));

vi.mock("~/lib/server/infrastructure/auth/read-authenticated-user", () => ({
  readAuthenticatedWorkspaceUser: readAuthenticatedWorkspaceUserMock,
}));

vi.mock("~/lib/server/usecase/workspace/workspace-bootstrap-service", () => ({
  createWorkspaceBootstrapService:
    createWorkspaceBootstrapServiceMock.mockReturnValue({
      loadWorkspaceBootstrap: loadWorkspaceBootstrapMock,
    }),
}));

vi.mock("~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway", () => ({
  installGlobalServerErrorLogging: installGlobalServerErrorLoggingMock,
  logServerRouteEvent: logServerRouteEventMock,
}));

import { loader } from "./api.workspace-bootstrap";

describe("/api/workspace-bootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readAuthenticatedWorkspaceUserMock.mockResolvedValue({
      id: 10,
      tenantId: "tenant-a",
      principalId: "principal-a",
    });
    loadWorkspaceBootstrapMock.mockResolvedValue({
      tenantId: "tenant-a",
      principalId: "principal-a",
      principal: null,
      azureProjects: [],
      azureTenants: [],
      azureSelection: null,
      azureDeploymentsByProjectId: {},
      threads: [],
      workspaceMcpServerProfiles: [],
      skills: [],
      skillRegistries: [],
      skillWarnings: [],
      registryWarnings: [],
      warnings: [],
    });
    logServerRouteEventMock.mockResolvedValue(undefined);
  });

  it("returns 405 with Allow for unsupported methods", async () => {
    const response = await loader({
      request: new Request("http://localhost/api/workspace-bootstrap", { method: "POST" }),
    } as never);

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
  });

  it("returns 401 when bootstrap auth is unavailable", async () => {
    readAuthenticatedWorkspaceUserMock.mockResolvedValueOnce(null);

    const response = await loader({
      request: new Request("http://localhost/api/workspace-bootstrap", { method: "GET" }),
    } as never);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "auth_required",
        message: "Azure login is required. Click Azure Login to continue.",
      },
    });
  });

  it("returns a data envelope for GET", async () => {
    const response = await loader({
      request: new Request("http://localhost/api/workspace-bootstrap", { method: "GET" }),
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: expect.objectContaining({
        tenantId: "tenant-a",
        principalId: "principal-a",
        workspaceMcpServerProfiles: [],
      }),
    });
  });
});
