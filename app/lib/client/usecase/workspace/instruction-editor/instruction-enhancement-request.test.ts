import { describe, expect, it } from "vitest";
import {
  buildInstructionEnhancementRequest,
} from "./instruction-enhancement-request";

describe("buildInstructionEnhancementRequest", () => {
  it("builds the request payload and preserves derived format metadata", () => {
    const draft = buildInstructionEnhancementRequest({
      currentInstruction: "# Improve this",
      loadedInstructionFileName: "prompt.md",
      activeAzureTenantId: "tenant-a",
      utilityAzureConnection: {
        projectName: "utility-project",
        baseUrl: "https://example.openai.azure.com",
        apiVersion: "2026-01-01",
      },
      deploymentName: "gpt-5",
      isUtilityReasoningEffortSupported: true,
      effectiveUtilityReasoningEffort: "medium",
    });

    expect(draft.instructionExtension).toBe("md");
    expect(draft.instructionLanguage).toBe("english");
    expect(draft.request).toEqual(
      expect.objectContaining({
        azureConfig: {
          tenantId: "tenant-a",
          projectName: "utility-project",
          baseUrl: "https://example.openai.azure.com",
          apiVersion: "2026-01-01",
          deploymentName: "gpt-5",
        },
        reasoningEffort: "medium",
        supportsReasoningEffort: true,
        enhanceAgentInstruction: expect.any(String),
      }),
    );
    expect(draft.request.message).toContain("<enhance_request>");
  });
});
