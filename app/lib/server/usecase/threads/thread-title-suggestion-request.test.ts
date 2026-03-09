import { describe, expect, it } from "vitest";
import {
  parseThreadTitleReasoningEffort,
  readThreadTitleSuggestionRequest,
} from "./thread-title-suggestion-request";

describe("parseThreadTitleReasoningEffort", () => {
  it("defaults to high when omitted", () => {
    expect(parseThreadTitleReasoningEffort({})).toEqual({ ok: true, value: "high" });
    expect(parseThreadTitleReasoningEffort("invalid")).toEqual({ ok: true, value: "high" });
  });

  it("accepts valid values", () => {
    expect(parseThreadTitleReasoningEffort({ reasoningEffort: "none" })).toEqual({
      ok: true,
      value: "none",
    });
    expect(parseThreadTitleReasoningEffort({ reasoningEffort: "medium" })).toEqual({
      ok: true,
      value: "medium",
    });
    expect(parseThreadTitleReasoningEffort({ reasoningEffort: "xhigh" })).toEqual({
      ok: true,
      value: "xhigh",
    });
    expect(parseThreadTitleReasoningEffort({ reasoningEffort: "minimal" })).toEqual({
      ok: true,
      value: "minimal",
    });
  });

  it("rejects invalid values", () => {
    expect(parseThreadTitleReasoningEffort({ reasoningEffort: "fast" })).toEqual({
      ok: false,
      error: "`reasoningEffort` must be one of: none, minimal, low, medium, high, xhigh.",
    });
    expect(parseThreadTitleReasoningEffort({ reasoningEffort: 1 })).toEqual({
      ok: false,
      error: "`reasoningEffort` must be a string.",
    });
  });
});

describe("readThreadTitleSuggestionRequest", () => {
  it("reads a valid title suggestion request", () => {
    expect(
      readThreadTitleSuggestionRequest({
        playgroundContent: "  summarize this thread  ",
        instruction: " concise ",
        reasoningEffort: "medium",
        azureConfig: {
          tenantId: "tenant-a",
          projectName: "project-a",
          baseUrl: "https://sample.openai.azure.com/openai/v1",
          apiVersion: "v1",
          deploymentName: "gpt-5-mini",
        },
      }),
    ).toEqual({
      ok: true,
      value: {
        playgroundContent: "summarize this thread",
        instruction: "concise",
        reasoningEffort: "medium",
        azureConfig: {
          tenantId: "tenant-a",
          projectName: "project-a",
          baseUrl: "https://sample.openai.azure.com/openai/v1/",
          apiVersion: "v1",
          deploymentName: "gpt-5-mini",
        },
      },
    });
  });

  it("returns validation issues for missing Azure fields", () => {
    expect(
      readThreadTitleSuggestionRequest({
        playgroundContent: "hello",
        azureConfig: {
          tenantId: "tenant-a",
          deploymentName: "gpt-5-mini",
        },
      }),
    ).toEqual({
      ok: false,
      issue: {
        statusCode: 422,
        code: "missing_azure_base_url",
        error: "Azure OpenAI base URL is missing.",
        eventName: "missing_azure_base_url",
        action: "validate_payload",
        message: "Azure OpenAI base URL is missing.",
      },
    });
  });
});
