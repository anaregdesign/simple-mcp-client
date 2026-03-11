import { describe, expect, it, vi } from "vitest";
import { ClientApiError } from "~/lib/client/infrastructure/api/api-client";
import {
  InstructionPatchesApiClient,
} from "./instruction-patches-api-client";

describe("InstructionPatchesApiClient", () => {
  it("posts instruction enhancement payload", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("/api/instruction-patches");
      expect(init?.method).toBe("POST");
      expect(init?.body).toBe(
        JSON.stringify({
          message: "Enhance this instruction",
          azureConfig: {
            tenantId: "tenant-a",
            projectName: "project-a",
            baseUrl: "https://example.openai.azure.com",
            apiVersion: "v1",
            deploymentName: "gpt-5",
          },
          supportsReasoningEffort: true,
          reasoningEffort: "high",
          enhanceAgentInstruction: "Improve the prompt",
        }),
      );

      return new Response(
        JSON.stringify({
          message: "--- a/instruction.md\n+++ b/instruction.md",
        }),
        { status: 200 },
      );
    });

    const client = new InstructionPatchesApiClient();
    const result = await client.enhanceInstruction(
      {
        message: "Enhance this instruction",
        azureConfig: {
          tenantId: "tenant-a",
          projectName: "project-a",
          baseUrl: "https://example.openai.azure.com",
          apiVersion: "v1",
          deploymentName: "gpt-5",
        },
        supportsReasoningEffort: true,
        reasoningEffort: "high",
        enhanceAgentInstruction: "Improve the prompt",
      },
      { fetchImpl },
    );

    expect(result.message).toBe("--- a/instruction.md\n+++ b/instruction.md");
  });

  it("surfaces auth_required responses and calls onAuthRequired", async () => {
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

    const client = new InstructionPatchesApiClient();

    await expect(
      client.enhanceInstruction(
        {
          message: "Enhance this instruction",
          azureConfig: {
            tenantId: "tenant-a",
            projectName: "project-a",
            baseUrl: "https://example.openai.azure.com",
            apiVersion: "v1",
            deploymentName: "gpt-5",
          },
          supportsReasoningEffort: false,
          enhanceAgentInstruction: "Improve the prompt",
        },
        { fetchImpl, onAuthRequired },
      ),
    ).rejects.toMatchObject({
      kind: "auth_required",
      message:
        "Azure login is required. Open Settings and sign in to enhance instructions.",
    } satisfies Partial<ClientApiError>);

    expect(onAuthRequired).toHaveBeenCalledTimes(1);
  });
});
