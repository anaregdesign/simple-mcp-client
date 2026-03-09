import { describe, expect, it, vi } from "vitest";
import { AzureSelectionApiClient } from "./azure-selection-api-client";

describe("AzureSelectionApiClient", () => {
  it("loads the saved Azure selection", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("/api/azure/selection");
      expect(init?.method).toBe("GET");

      return new Response(
        JSON.stringify({
          selection: {
            theme: "dark",
          },
        }),
        { status: 200 },
      );
    });

    const client = new AzureSelectionApiClient();
    const result = await client.loadSelection({ fetchImpl });

    expect(result.selection).toEqual({ theme: "dark" });
  });

  it("saves a utility selection payload", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("/api/azure/selection");
      expect(init?.method).toBe("PATCH");
      expect(init?.body).toBe(
        JSON.stringify({
          target: "utility",
          projectId: "project-a",
          deploymentName: "deploy-a",
          reasoningEffort: "medium",
        }),
      );

      return new Response(
        JSON.stringify({
          selection: {
            utility: {
              projectId: "project-a",
              deploymentName: "deploy-a",
              reasoningEffort: "medium",
            },
          },
        }),
        { status: 200 },
      );
    });

    const client = new AzureSelectionApiClient();
    const result = await client.saveSelection(
      {
        target: "utility",
        projectId: "project-a",
        deploymentName: "deploy-a",
        reasoningEffort: "medium",
      },
      { fetchImpl },
    );

    expect(result.selection).toEqual({
      utility: {
        projectId: "project-a",
        deploymentName: "deploy-a",
        reasoningEffort: "medium",
      },
    });
  });
});
