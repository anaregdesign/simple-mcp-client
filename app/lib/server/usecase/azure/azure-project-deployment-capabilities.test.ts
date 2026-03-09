import { describe, expect, it } from "vitest";
import {
  parseReasoningEffortOptionsFromString,
  resolveReasoningEffortOptionsByModelName,
} from "~/lib/server/usecase/azure/azure-project-deployment-capabilities";

describe("parseReasoningEffortOptionsFromString", () => {
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
});

describe("resolveReasoningEffortOptionsByModelName", () => {
  it("returns model-specific options for GPT-5.4 family", () => {
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
  });

  it("returns model-specific options for GPT-5.2 family", () => {
    expect(resolveReasoningEffortOptionsByModelName("gpt-5.2")).toEqual([
      "none",
      "low",
      "medium",
      "high",
      "xhigh",
    ]);
  });

  it("returns model-specific options for o3-pro", () => {
    expect(resolveReasoningEffortOptionsByModelName("o3-pro")).toEqual(["high"]);
  });

  it("does not infer options for unknown models", () => {
    expect(resolveReasoningEffortOptionsByModelName("o9-experimental")).toEqual([]);
  });
});
