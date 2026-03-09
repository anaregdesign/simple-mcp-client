import { describe, expect, it } from "vitest";
import {
  filterReasoningEffortOptionsForDeploymentCompatibility,
  filterReasoningEffortOptionsForWebSearch,
  resolveEffectiveReasoningEffort,
  selectActiveAzureConnection,
} from "./selectors";

describe("azure-settings selectors", () => {
  it("selects the preferred Azure connection when present", () => {
    const connection = selectActiveAzureConnection(
      [
        { id: "project-a", projectName: "Project A", baseUrl: "https://a", apiVersion: "2025-01-01" },
        { id: "project-b", projectName: "Project B", baseUrl: "https://b", apiVersion: "2025-01-01" },
      ],
      "project-b",
    );

    expect(connection?.id).toBe("project-b");
  });

  it("filters minimal reasoning effort for gpt-5.4 and web search", () => {
    expect(
      filterReasoningEffortOptionsForDeploymentCompatibility(
        ["none", "minimal", "medium"],
        "gpt-5.4",
      ),
    ).toEqual(["none", "medium"]);
    expect(
      filterReasoningEffortOptionsForWebSearch(
        ["none", "minimal", "medium"],
        true,
      ),
    ).toEqual(["none", "medium"]);
  });

  it("falls back to the first supported reasoning effort", () => {
    expect(
      resolveEffectiveReasoningEffort("minimal", ["none", "medium"], "medium"),
    ).toBe("medium");
  });
});
