/**
 * Test module verifying api.azure.selection behavior.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  readAuthenticatedIdentityMock,
  readStoredSelectionMock,
  saveStoredSelectionMock,
  deleteStoredSelectionMock,
  installGlobalServerErrorLoggingMock,
  logServerRouteEventMock,
} = vi.hoisted(() => ({
  readAuthenticatedIdentityMock: vi.fn(),
  readStoredSelectionMock: vi.fn(),
  saveStoredSelectionMock: vi.fn(),
  deleteStoredSelectionMock: vi.fn(),
  installGlobalServerErrorLoggingMock: vi.fn(),
  logServerRouteEventMock: vi.fn(),
}));

vi.mock("~/lib/server/observability/runtime-event-log", () => ({
  installGlobalServerErrorLogging: installGlobalServerErrorLoggingMock,
  logServerRouteEvent: logServerRouteEventMock,
}));

vi.mock("~/lib/server/infrastructure/auth/read-authenticated-identity", () => ({
  readAuthenticatedIdentity: readAuthenticatedIdentityMock,
}));

vi.mock("~/lib/server/usecase/azure/azure-selection-service", async () => {
  const actual = await vi.importActual<
    typeof import("~/lib/server/usecase/azure/azure-selection-service")
  >("~/lib/server/usecase/azure/azure-selection-service");

  return {
    ...actual,
    azureSelectionService: {
      readStoredSelection: readStoredSelectionMock,
      saveStoredSelection: saveStoredSelectionMock,
      deleteStoredSelection: deleteStoredSelectionMock,
    },
  };
});

import { action, loader, parseAzureSelectionPreference } from "./api.azure.selection";

describe("parseAzureSelectionPreference", () => {
  it("parses and trims a valid selection payload", () => {
    const result = parseAzureSelectionPreference({
      target: "playground",
      projectId: " project-a ",
      deploymentName: " deploy-a ",
    });

    expect(result).not.toBeNull();
    expect(result?.target).toBe("playground");
    expect(result?.projectId).toBe("project-a");
    expect(result?.deploymentName).toBe("deploy-a");
    expect(result?.reasoningEffort).toBeNull();
    expect(result?.theme).toBeNull();
  });

  it("accepts utility target", () => {
    const result = parseAzureSelectionPreference({
      target: "utility",
      projectId: "project-b",
      deploymentName: "deploy-b",
      reasoningEffort: "medium",
    });

    expect(result).toEqual({
      target: "utility",
      projectId: "project-b",
      deploymentName: "deploy-b",
      reasoningEffort: "medium",
      theme: null,
    });
  });

  it("accepts theme-only payload", () => {
    const result = parseAzureSelectionPreference({
      theme: "dark",
    });

    expect(result).toEqual({
      target: null,
      projectId: "",
      deploymentName: "",
      reasoningEffort: null,
      theme: "dark",
    });
  });

  it("returns null when required fields are missing", () => {
    expect(
      parseAzureSelectionPreference({
        target: "playground",
        projectId: "project-a",
      }),
    ).toBeNull();
    expect(
      parseAzureSelectionPreference({
        target: "playground",
        projectId: "",
        deploymentName: "deploy-a",
      }),
    ).toBeNull();
    expect(
      parseAzureSelectionPreference({
        target: "invalid",
        projectId: "project-a",
        deploymentName: "deploy-a",
      }),
    ).toBeNull();
    expect(
      parseAzureSelectionPreference({
        target: "utility",
        projectId: "project-b",
        deploymentName: "deploy-b",
      }),
    ).toBeNull();
    expect(
      parseAzureSelectionPreference({
        projectId: "project-a",
      }),
    ).toBeNull();
    expect(parseAzureSelectionPreference("invalid")).toBeNull();
  });
});

describe("/api/azure/selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readAuthenticatedIdentityMock.mockResolvedValue({
      tenantId: "tenant-a",
      principalId: "principal-a",
    });
    readStoredSelectionMock.mockResolvedValue({
      tenantId: "tenant-a",
      principalId: "principal-a",
      theme: "dark",
      playground: {
        projectId: "project-a",
        deploymentName: "deploy-a",
      },
      utility: {
        projectId: "project-b",
        deploymentName: "deploy-b",
        reasoningEffort: "medium",
      },
    });
    saveStoredSelectionMock.mockResolvedValue({
      selection: {
        tenantId: "tenant-a",
        principalId: "principal-a",
        theme: "dark",
        playground: {
          projectId: "project-a",
          deploymentName: "deploy-a",
        },
        utility: {
          projectId: "project-b",
          deploymentName: "deploy-b",
          reasoningEffort: "medium",
        },
      },
      created: false,
    });
    deleteStoredSelectionMock.mockResolvedValue(true);
    logServerRouteEventMock.mockResolvedValue(undefined);
  });

  it("returns 405 with Allow for unsupported methods", async () => {
    const response = await action({
      request: new Request("http://localhost/api/azure/selection", { method: "PUT" }),
    } as never);

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, PATCH, DELETE");
  });

  it("returns 401 when unauthenticated", async () => {
    readAuthenticatedIdentityMock.mockResolvedValueOnce(null);

    const response = await action({
      request: new Request("http://localhost/api/azure/selection", { method: "PATCH" }),
    } as never);

    expect(response.status).toBe(401);
  });

  it("returns 201 and Location when creating a new selection", async () => {
    saveStoredSelectionMock.mockResolvedValueOnce({
      selection: {
        tenantId: "tenant-a",
        principalId: "principal-a",
        theme: "dark",
        playground: {
          projectId: "project-a",
          deploymentName: "deploy-a",
        },
        utility: {
          projectId: "project-b",
          deploymentName: "deploy-b",
          reasoningEffort: "medium",
        },
      },
      created: true,
    });

    const response = await action({
      request: new Request("http://localhost/api/azure/selection", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          target: "playground",
          projectId: "project-a",
          deploymentName: "deploy-a",
        }),
      }),
    } as never);

    expect(response.status).toBe(201);
    expect(response.headers.get("location")).toBe("/api/azure/selection");
  });

  it("returns 422 for invalid patch payload", async () => {
    const response = await action({
      request: new Request("http://localhost/api/azure/selection", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          target: "playground",
          projectId: "",
        }),
      }),
    } as never);

    expect(response.status).toBe(422);
  });

  it("accepts theme-only patch payload", async () => {
    const response = await action({
      request: new Request("http://localhost/api/azure/selection", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          theme: "dark",
        }),
      }),
    } as never);

    expect(response.status).toBe(200);
    expect(saveStoredSelectionMock).toHaveBeenCalledWith(
      {
        tenantId: "tenant-a",
        principalId: "principal-a",
      },
      expect.objectContaining({
        theme: "dark",
      }),
    );
  });

  it("deletes selection and returns 204", async () => {
    const response = await action({
      request: new Request("http://localhost/api/azure/selection", {
        method: "DELETE",
      }),
    } as never);

    expect(response.status).toBe(204);
  });

  it("returns 404 when deleting non-existing selection", async () => {
    deleteStoredSelectionMock.mockResolvedValueOnce(false);

    const response = await action({
      request: new Request("http://localhost/api/azure/selection", {
        method: "DELETE",
      }),
    } as never);

    expect(response.status).toBe(404);
  });

  it("loader returns 405 for unsupported methods", async () => {
    const response = await loader({
      request: new Request("http://localhost/api/azure/selection", { method: "POST" }),
    } as never);

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, PATCH, DELETE");
  });
});
