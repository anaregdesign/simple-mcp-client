import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProjectId } from "~/lib/contracts/api/azure-project-id";

const {
  getArmAccessTokenMock,
  resolveAzurePrincipalProfileMock,
  listProjectDeploymentsMock,
  createAzureProjectQueryServiceMock,
  createAzureArmPagedFetchGatewayMock,
  installGlobalServerErrorLoggingMock,
  logServerRouteEventMock,
} = vi.hoisted(() => ({
  getArmAccessTokenMock: vi.fn(),
  resolveAzurePrincipalProfileMock: vi.fn(),
  listProjectDeploymentsMock: vi.fn(),
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
      listProjectDeployments: listProjectDeploymentsMock,
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

import { loader } from "./api.azure.projects.$projectId.deployments";

describe("/api/azure/projects/:projectId/deployments route", () => {
  const projectRef = {
    subscriptionId: "subscription-a",
    resourceGroup: "resource-group-a",
    accountName: "account-a",
  } as const;
  const projectId = createProjectId(projectRef);

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
    listProjectDeploymentsMock.mockResolvedValue([
      {
        name: "gpt-4.1",
        reasoningEffortOptions: ["low", "medium"],
      },
    ]);
    logServerRouteEventMock.mockResolvedValue(undefined);
  });

  it("returns 405 for unsupported methods", async () => {
    const response = await loader({
      request: new Request(`http://localhost/api/azure/projects/${projectId}/deployments`, {
        method: "POST",
      }),
      params: {
        projectId,
      },
    } as never);

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
  });

  it("returns 401 when Azure login is required", async () => {
    getArmAccessTokenMock.mockResolvedValueOnce({ ok: false });

    const response = await loader({
      request: new Request(`http://localhost/api/azure/projects/${projectId}/deployments`, {
        method: "GET",
      }),
      params: {
        projectId,
      },
    } as never);

    expect(response.status).toBe(401);
  });

  it("returns 422 for an invalid projectId", async () => {
    const response = await loader({
      request: new Request("http://localhost/api/azure/projects/%20/deployments", {
        method: "GET",
      }),
      params: {
        projectId: " ",
      },
    } as never);

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      code: "invalid_project_id",
      error: "Invalid projectId.",
    });
    expect(logServerRouteEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        route: "/api/azure/projects/:projectId/deployments",
        eventName: "invalid_project_id",
      }),
    );
  });

  it("loads deployments for the requested project", async () => {
    const response = await loader({
      request: new Request(`http://localhost/api/azure/projects/${projectId}/deployments`, {
        method: "GET",
      }),
      params: {
        projectId: ` ${projectId} `,
      },
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      deployments: [
        {
          name: "gpt-4.1",
          reasoningEffortOptions: ["low", "medium"],
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
    expect(listProjectDeploymentsMock).toHaveBeenCalledWith("access-token", projectRef);
  });

  it("maps deployment load failures to 502", async () => {
    listProjectDeploymentsMock.mockRejectedValueOnce(new Error("ARM gateway timeout"));

    const response = await loader({
      request: new Request(`http://localhost/api/azure/projects/${projectId}/deployments`, {
        method: "GET",
      }),
      params: {
        projectId,
      },
    } as never);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      code: "load_azure_deployments_failed",
      error: "Failed to load Azure deployment data: ARM gateway timeout",
    });
  });
});
