import { describe, expect, it } from "vitest";
import {
  buildModelCapabilitiesMap,
  isAgentsSdkCompatibleDeployment,
  parseReasoningEffortOptionsFromString,
  resolveDeploymentReasoningEffortOptions,
  resolveReasoningEffortOptionsByModelName,
} from "~/lib/domain/value-objects/azure-openai-model-capabilities";

describe("azure-openai-model-capabilities", () => {
  it("extracts canonical reasoning effort values from delimited strings", () => {
    expect(
      parseReasoningEffortOptionsFromString("none, low, medium, high, xhigh"),
    ).toEqual(["none", "low", "medium", "high", "xhigh"]);
  });

  it("extracts reasoning effort values from JSON arrays", () => {
    expect(
      parseReasoningEffortOptionsFromString("[\"xhigh\", \"low\", \"minimal\"]"),
    ).toEqual(["minimal", "low", "xhigh"]);
  });

  it("returns model-specific options for known model families", () => {
    expect(resolveReasoningEffortOptionsByModelName("gpt-5.4")).toEqual([
      "none",
      "low",
      "medium",
      "high",
      "xhigh",
    ]);
    expect(
      resolveReasoningEffortOptionsByModelName("gpt-5.4-pro-2026-03-05"),
    ).toEqual(["none", "low", "medium", "high", "xhigh"]);
    expect(resolveReasoningEffortOptionsByModelName("gpt-5.2")).toEqual([
      "none",
      "low",
      "medium",
      "high",
      "xhigh",
    ]);
    expect(resolveReasoningEffortOptionsByModelName("o3-pro")).toEqual([
      "high",
    ]);
    expect(resolveReasoningEffortOptionsByModelName("o9-experimental")).toEqual(
      [],
    );
  });

  it("reads deployment capabilities and infers chat compatibility", () => {
    const modelCapabilities = buildModelCapabilitiesMap([
      {
        model: {
          name: "gpt-5-chat",
          version: "2026-03-01",
          format: "OpenAI",
          capabilities: {
            chatCompletion: true,
            reasoningEffortValues: ["xhigh", "low"],
          },
        },
      },
    ]);

    expect(
      isAgentsSdkCompatibleDeployment(
        {
          provisioningState: "Succeeded",
          model: {
            name: "gpt-5-chat",
            version: "2026-03-01",
            format: "OpenAI",
            capabilities: {},
          },
        },
        modelCapabilities,
      ),
    ).toBe(true);

    expect(
      resolveDeploymentReasoningEffortOptions(
        "gpt-5-chat",
        modelCapabilities.get("gpt-5-chat::2026-03-01"),
      ),
    ).toEqual(["low", "medium", "high", "xhigh"]);
  });
});
