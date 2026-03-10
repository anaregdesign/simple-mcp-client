import { describe, expect, it } from "vitest";
import {
  normalizeAzureOpenAIBaseURL,
  readChatAzureConfigFromUnknown,
} from "~/lib/domain/value-objects/chat-azure-config";

describe("chat-azure-config", () => {
  it("normalizes Azure OpenAI base URLs to the v1 endpoint", () => {
    expect(
      normalizeAzureOpenAIBaseURL("https://example.openai.azure.com"),
    ).toBe("https://example.openai.azure.com/openai/v1/");
    expect(
      normalizeAzureOpenAIBaseURL(
        "https://example.openai.azure.com/openai/v1///",
      ),
    ).toBe("https://example.openai.azure.com/openai/v1/");
  });

  it("returns normalized baseUrl when reading trusted config", () => {
    expect(
      readChatAzureConfigFromUnknown({
        tenantId: "tenant-a",
        projectId: "project-a",
        projectName: "Project A",
        baseUrl: "https://example.openai.azure.com/",
        apiVersion: "v1",
        deploymentName: "gpt-5",
      }),
    ).toEqual({
      tenantId: "tenant-a",
      projectId: "project-a",
      projectName: "Project A",
      baseUrl: "https://example.openai.azure.com/openai/v1/",
      apiVersion: "v1",
      deploymentName: "gpt-5",
    });
  });
});
