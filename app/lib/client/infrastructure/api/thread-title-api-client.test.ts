import { describe, expect, it, vi } from "vitest";
import { ClientApiError } from "~/lib/client/infrastructure/api/api-client";
import {
  ThreadTitleApiClient,
} from "~/lib/client/infrastructure/api/thread-title-api-client";

describe("ThreadTitleApiClient", () => {
  it("posts a thread title suggestion request", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("/api/threads/title-suggestions");
      expect(init?.method).toBe("POST");
      expect(init?.body).toBe(
        JSON.stringify({
          playgroundContent: "Summarize this thread",
          instruction: "# Instruction",
          azureConfig: {
            tenantId: "tenant-a",
            projectName: "project-a",
            baseUrl: "https://example.openai.azure.com",
            apiVersion: "v1",
            deploymentName: "gpt-5",
          },
          supportsReasoningEffort: true,
          reasoningEffort: "high",
        }),
      );

      return new Response(
        JSON.stringify({
          title: "Generated title",
        }),
        { status: 200 },
      );
    });

    const client = new ThreadTitleApiClient();
    const result = await client.generateTitle(
      {
        playgroundContent: "Summarize this thread",
        instruction: "# Instruction",
        azureConfig: {
          tenantId: "tenant-a",
          projectName: "project-a",
          baseUrl: "https://example.openai.azure.com",
          apiVersion: "v1",
          deploymentName: "gpt-5",
        },
        supportsReasoningEffort: true,
        reasoningEffort: "high",
      },
      { fetchImpl },
    );

    expect(result.title).toBe("Generated title");
  });

  it("surfaces auth_required responses", async () => {
    const onAuthRequired = vi.fn();
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          error: "Azure authentication failed.",
          errorCode: "azure_login_required",
        }),
        { status: 401 },
      );
    });

    const client = new ThreadTitleApiClient();

    await expect(
      client.generateTitle(
        {
          playgroundContent: "Summarize this thread",
          instruction: "# Instruction",
          azureConfig: {
            tenantId: "tenant-a",
            projectName: "project-a",
            baseUrl: "https://example.openai.azure.com",
            apiVersion: "v1",
            deploymentName: "gpt-5",
          },
          supportsReasoningEffort: false,
        },
        { fetchImpl, onAuthRequired },
      ),
    ).rejects.toMatchObject({
      kind: "auth_required",
      message:
        "Azure login is required. Open Settings and sign in to generate thread titles.",
    } satisfies Partial<ClientApiError>);

    expect(onAuthRequired).toHaveBeenCalledTimes(1);
  });
});
