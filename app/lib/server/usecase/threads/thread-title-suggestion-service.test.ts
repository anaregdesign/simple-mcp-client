import { describe, expect, it, vi } from "vitest";
import type { ThreadTitleGenerationGateway } from "~/lib/domain/repositories/thread-title-generation-gateway";
import {
  buildThreadTitleUpstreamError,
  createThreadTitleSuggestionService,
  extractThreadAutoTitle,
} from "./thread-title-suggestion-service";

describe("extractThreadAutoTitle", () => {
  it("normalizes plain text title output", () => {
    expect(extractThreadAutoTitle('  "プロジェクト 計画" \nsecond line')).toBe(
      "プロジェクト 計画",
    );
  });

  it("supports JSON object output and truncates to 20 characters", () => {
    expect(extractThreadAutoTitle({ title: "12345678901234567890extra" })).toBe(
      "12345678901234567890",
    );
  });

  it("supports JSON string output", () => {
    expect(extractThreadAutoTitle('{"title":"初回リリース準備"}')).toBe("初回リリース準備");
  });

  it("throws when output is empty", () => {
    expect(() => extractThreadAutoTitle("   ")).toThrow("Thread title response is empty.");
  });
});

describe("ThreadTitleSuggestionService", () => {
  it("builds a prompt and reads the normalized title from the gateway output", async () => {
    const gateway: ThreadTitleGenerationGateway = {
      generateTitle: vi.fn(async () => ({ title: "  Release Plan  " })),
    };
    const service = createThreadTitleSuggestionService(gateway);

    await expect(
      service.generateTitle({
        playgroundContent: "Need a short thread title",
        instruction: "Be concise",
        azureConfig: {
          tenantId: "tenant-a",
          projectName: "project-a",
          baseUrl: "https://sample.openai.azure.com/openai/v1/",
          apiVersion: "v1",
          deploymentName: "gpt-5-mini",
        },
        reasoningEffort: "medium",
      }),
    ).resolves.toBe("Release Plan");

    expect(gateway.generateTitle).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-a",
        deploymentName: "gpt-5-mini",
        reasoningEffort: "medium",
        prompt: expect.stringContaining("Need a short thread title"),
        systemPrompt: expect.any(String),
      }),
    );
  });
});

describe("buildThreadTitleUpstreamError", () => {
  it("maps Azure credential failures to auth_required", () => {
    expect(
      buildThreadTitleUpstreamError(
        new Error("DefaultAzureCredential failed to retrieve a token."),
        "gpt-5-mini",
      ),
    ).toEqual({
      status: 401,
      payload: {
        code: "auth_required",
        error:
          'Azure authentication failed. Click "Azure Login", complete sign-in, and try again.',
        errorCode: "azure_login_required",
      },
    });
  });

  it("adds deployment guidance for missing resources", () => {
    expect(
      buildThreadTitleUpstreamError(new Error("Resource not found"), "gpt-5-mini"),
    ).toEqual({
      status: 502,
      payload: {
        code: "upstream_service_error",
        error:
          "Resource not found Check Azure base URL and deployment name (gpt-5-mini).",
      },
    });
  });
});
