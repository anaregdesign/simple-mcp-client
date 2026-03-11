import { describe, expect, it } from "vitest";
import {
  AzureSelectionPreference,
  createAzureSelectionTargetPreference,
  createAzureUtilitySelectionTargetPreference,
} from "~/lib/domain/entities/azure-selection-preference";

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
    expect(preference.tenantId).toBe("tenant-1");
    expect(preference.utility).toMatchObject({
      projectId: "project-b",
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

  it("normalizes target preferences and fills default reasoning effort", () => {
    expect(
      createAzureSelectionTargetPreference(" project-a ", " deploy-a "),
    ).toEqual({
      projectId: "project-a",
      deploymentName: "deploy-a",
    });

    expect(
      createAzureUtilitySelectionTargetPreference(
        " project-b ",
        " deploy-b ",
        null,
      ),
    ).toEqual({
      projectId: "project-b",
      deploymentName: "deploy-b",
      reasoningEffort: "high",
    });
  });

  it("preserves untouched selections when applying changes", () => {
    const preference = new AzureSelectionPreference({
      tenantId: "tenant-1",
      principalId: "principal-1",
      theme: "light",
      playground: {
        projectId: "project-a",
        deploymentName: "deploy-a",
      },
      utility: null,
    });

    const updated = preference.withChanges({
      utility: createAzureUtilitySelectionTargetPreference(
        "project-b",
        "deploy-b",
        "medium",
      ),
    });

    expect(updated.theme).toBe("light");
    expect(updated.playground).toEqual({
      projectId: "project-a",
      deploymentName: "deploy-a",
    });
    expect(updated.utility).toEqual({
      projectId: "project-b",
      deploymentName: "deploy-b",
      reasoningEffort: "medium",
    });
  });

  it("returns defensive copies for nested selections", () => {
    const preference = new AzureSelectionPreference({
      tenantId: "tenant-1",
      principalId: "principal-1",
      theme: "light",
      playground: {
        projectId: "project-a",
        deploymentName: "deploy-a",
      },
      utility: null,
    });

    const playground = preference.playground;
    if (!playground) {
      throw new Error("Expected playground selection.");
    }

    playground.projectId = "mutated";

    expect(preference.playground).toEqual({
      projectId: "project-a",
      deploymentName: "deploy-a",
    });
  });
});
