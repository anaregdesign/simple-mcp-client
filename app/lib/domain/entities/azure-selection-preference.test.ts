import { describe, expect, it } from "vitest";
import { AzureSelectionPreference } from "~/lib/domain/entities/azure-selection-preference";

describe("AzureSelectionPreference", () => {
  it("keeps playground and utility selections in one model", () => {
    const preference = new AzureSelectionPreference({
      tenantId: "tenant-1",
      principalId: "principal-1",
      theme: "light",
      playground: {
        projectId: "project-a",
        deploymentName: "gpt-4.1",
      },
      utility: {
        projectId: "project-b",
        deploymentName: "gpt-4.1-mini",
        reasoningEffort: "high",
      },
    });

    expect(preference.hasSelection()).toBe(true);
    expect(preference.toSnapshot()).toMatchObject({
      tenantId: "tenant-1",
      utility: {
        projectId: "project-b",
      },
    });
  });

  it("rejects missing tenant ids", () => {
    expect(
      () =>
        new AzureSelectionPreference({
          tenantId: "",
          principalId: "principal-1",
          theme: "dark",
          playground: null,
          utility: null,
        }),
    ).toThrow("AzureSelectionPreference tenantId is required.");
  });
});
