import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getArmAccessTokenMock,
  resolveAzurePrincipalProfileMock,
  loadAzureProjectsWithFallbackMock,
  loadAzureTenantsWithFallbackMock,
  createAzureProjectQueryServiceMock,
  createAzureArmPagedFetchGatewayMock,
  installGlobalServerErrorLoggingMock,
  logServerRouteEventMock,
} = vi.hoisted(() => ({
  getArmAccessTokenMock: vi.fn(),
  resolveAzurePrincipalProfileMock: vi.fn(),
  loadAzureProjectsWithFallbackMock: vi.fn(),
  loadAzureTenantsWithFallbackMock: vi.fn(),
  createAzureProjectQueryServiceMock: vi.fn(),
  createAzureArmPagedFetchGatewayMock: vi.fn(() => ({})),
  installGlobalServerErrorLoggingMock: vi.fn(),
  logServerRouteEventMock: vi.fn(),
}));

vi.mock("~/lib/server/infrastructure/azure/arm-access-context", () => ({
  getArmAccessToken: getArmAccessTokenMock,
  resolveAzurePrincipalProfile: resolveAzurePrincipalProfileMock,
}));

vi.mock("~/lib/server/infrastructure/gateways/azure/arm-paged-fetch-gateway", () => ({
  createAzureArmPagedFetchGateway: createAzureArmPagedFetchGatewayMock,
}));

vi.mock("~/lib/server/usecase/azure/azure-project-service", async () => {
  const actual = await vi.importActual<
    typeof import("~/lib/server/usecase/azure/azure-project-service")
  >("~/lib/server/usecase/azure/azure-project-service");

  return {
    ...actual,
    createAzureProjectQueryService: createAzureProjectQueryServiceMock.mockReturnValue({
      loadAzureProjectsWithFallback: loadAzureProjectsWithFallbackMock,
      loadAzureTenantsWithFallback: loadAzureTenantsWithFallbackMock,
    }),
  };
});

vi.mock(
  "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway",
  () => ({
    installGlobalServerErrorLogging: installGlobalServerErrorLoggingMock,
    logServerRouteEvent: logServerRouteEventMock,
  }),
);

import { loader } from "./api.azure.projects";

describe("/api/azure/projects route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getArmAccessTokenMock.mockResolvedValue({
      ok: true,
      token: "access-token",
      tenantId: "tenant-a",
      principalId: "principal-a",
    });
    resolveAzurePrincipalProfileMock.mockResolvedValue({
      tenantId: "tenant-a",
      principalId: "principal-a",
      displayName: "Azure User",
      principalName: "user@contoso.com",
      principalType: "user",
    });
    loadAzureProjectsWithFallbackMock.mockResolvedValue([
      {
        id: "project-a",
        projectName: "Project A",
        baseUrl: "https://example.openai.azure.com/openai/v1/",
        apiVersion: "2025-01-01-preview",
      },
    ]);
    loadAzureTenantsWithFallbackMock.mockResolvedValue([
      {
        tenantId: "tenant-a",
        displayName: "Contoso",
        defaultDomain: "contoso.com",
      },
    ]);
    logServerRouteEventMock.mockResolvedValue(undefined);
  });

  it("returns 405 for unsupported methods", async () => {
    const response = await loader({
      request: new Request("http://localhost/api/azure/projects", { method: "POST" }),
    } as never);

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
  });

  it("returns 401 when Azure login is required", async () => {
    getArmAccessTokenMock.mockResolvedValueOnce({ ok: false });

    const response = await loader({
      request: new Request("http://localhost/api/azure/projects", { method: "GET" }),
    } as never);

    expect(response.status).toBe(401);
  });

  it("loads projects and tenants for the requested tenant", async () => {
    const response = await loader({
      request: new Request("http://localhost/api/azure/projects?tenantId=%20tenant-b%20", {
        method: "GET",
      }),
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      projects: [
        {
          id: "project-a",
          projectName: "Project A",
          baseUrl: "https://example.openai.azure.com/openai/v1/",
          apiVersion: "2025-01-01-preview",
        },
      ],
      tenants: [
        {
          tenantId: "tenant-a",
          displayName: "Contoso",
          defaultDomain: "contoso.com",
        },
      ],
      principal: {
        tenantId: "tenant-a",
        principalId: "principal-a",
        displayName: "Azure User",
        principalName: "user@contoso.com",
        principalType: "user",
      },
      tenantId: "tenant-a",
      principalId: "principal-a",
      authRequired: false,
    });
    expect(getArmAccessTokenMock).toHaveBeenCalledWith(undefined, "tenant-b");
    expect(loadAzureProjectsWithFallbackMock).toHaveBeenCalledWith("access-token");
    expect(loadAzureTenantsWithFallbackMock).toHaveBeenCalledWith(
      "access-token",
      "tenant-a",
    );
  });

  it("maps Azure auth errors to 401", async () => {
    loadAzureProjectsWithFallbackMock.mockRejectedValueOnce(
      new Error("AuthenticationRequiredError: Automatic authentication has been disabled."),
    );

    const response = await loader({
      request: new Request("http://localhost/api/azure/projects", { method: "GET" }),
    } as never);

    expect(response.status).toBe(401);
    expect(logServerRouteEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        route: "/api/azure/projects",
        eventName: "azure_auth_required",
      }),
    );
  });

  it("maps project load failures to 502", async () => {
    loadAzureProjectsWithFallbackMock.mockRejectedValueOnce(new Error("gateway timeout"));

    const response = await loader({
      request: new Request("http://localhost/api/azure/projects", { method: "GET" }),
    } as never);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      code: "load_azure_projects_failed",
      error: "Failed to load Azure project data: gateway timeout",
    });
  });
});
