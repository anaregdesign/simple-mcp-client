import { describe, expect, it, vi } from "vitest";
import { AzureProjectsApiClient } from "./azure-projects-api-client";

describe("AzureProjectsApiClient", () => {
  it("loads projects with tenant query", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("/api/azure/projects?tenantId=tenant-a");
      expect(init?.method).toBe("GET");

      return new Response(
        JSON.stringify({
          projects: [{ id: "project-a" }],
          tenantId: "tenant-a",
          principalId: "principal-a",
        }),
        { status: 200 },
      );
    });

    const client = new AzureProjectsApiClient();
    const result = await client.loadProjects({
      preferredTenantId: "tenant-a",
      fetchImpl,
    });

    expect(result.projects).toEqual([{ id: "project-a" }]);
  });

  it("loads deployments for a project", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("/api/azure/projects/project-a/deployments");
      expect(init?.method).toBe("GET");

      return new Response(
        JSON.stringify({
          deployments: [{ name: "deploy-a" }],
        }),
        { status: 200 },
      );
    });

    const client = new AzureProjectsApiClient();
    const result = await client.loadDeployments("project-a", { fetchImpl });

    expect(result.deployments).toEqual([{ name: "deploy-a" }]);
  });
});
