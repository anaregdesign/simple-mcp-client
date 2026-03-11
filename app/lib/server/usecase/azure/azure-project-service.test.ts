import { describe, expect, it, vi } from "vitest";
import {
  createAzureProjectQueryService,
  isLikelyAzureAuthError,
} from "~/lib/server/usecase/azure/azure-project-service";
import type { AzureProjectQueryGateway } from "~/lib/domain/repositories/azure-project-query-gateway";

function createAzureProjectQueryGatewayMock(): AzureProjectQueryGateway {
  return {
    listAzureOpenAIAccounts: vi.fn(),
    listAzureTenants: vi.fn(),
    listAzureProjectDeployments: vi.fn(),
    listAzureProjectModels: vi.fn(),
  };
}

describe("AzureProjectQueryService", () => {
  it("dedupes duplicate project ids and disambiguates duplicate names", async () => {
    const queryGateway = createAzureProjectQueryGatewayMock();
    vi.mocked(queryGateway.listAzureOpenAIAccounts).mockResolvedValue([
      {
        subscriptionId: "sub-a",
        resourceGroup: "rg-one",
        accountName: "playground",
        baseUrl: "https://playground.openai.azure.com/openai/v1/",
      },
      {
        subscriptionId: "sub-a",
        resourceGroup: "rg-two",
        accountName: "playground",
        baseUrl: "https://playground-two.openai.azure.com/openai/v1/",
      },
      {
        subscriptionId: "sub-a",
        resourceGroup: "rg-one",
        accountName: "playground",
        baseUrl: "https://playground.openai.azure.com/openai/v1/",
      },
    ]);
    const service = createAzureProjectQueryService({ queryGateway });

    await expect(
      service.loadAzureProjectsWithFallback("token-a"),
    ).resolves.toEqual([
      {
        id: expect.any(String),
        projectName: "playground (rg-one)",
        baseUrl: "https://playground.openai.azure.com/openai/v1/",
        apiVersion: "v1",
      },
      {
        id: expect.any(String),
        projectName: "playground (rg-two)",
        baseUrl: "https://playground-two.openai.azure.com/openai/v1/",
        apiVersion: "v1",
      },
    ]);
  });

  it("filters unsupported deployments and merges duplicate deployment names", async () => {
    const queryGateway = createAzureProjectQueryGatewayMock();
    vi.mocked(queryGateway.listAzureProjectModels).mockResolvedValue([
      {
        model: {
          name: "gpt-5",
          version: "2025-01-01",
          format: "OpenAI",
          capabilities: {
            chatCompletion: true,
          },
        },
      },
    ]);
    vi.mocked(queryGateway.listAzureProjectDeployments).mockResolvedValue([
      {
        name: "deploy-a",
        capability: {
          provisioningState: "Succeeded",
          model: {
            name: "gpt-5",
            version: "2025-01-01",
            format: "OpenAI",
            capabilities: {},
          },
        },
      },
      {
        name: "deploy-a",
        capability: {
          provisioningState: "Succeeded",
          model: {
            name: "gpt-5",
            version: "",
            format: "OpenAI",
            capabilities: {},
          },
        },
      },
      {
        name: "deploy-b",
        capability: {
          provisioningState: "Failed",
          model: {
            name: "gpt-5",
            version: "2025-01-01",
            format: "OpenAI",
            capabilities: {},
          },
        },
      },
      {
        name: "deploy-c",
        capability: {
          provisioningState: "Succeeded",
          model: {
            name: "text-embedding-3-large",
            version: "1",
            format: "OpenAI",
            capabilities: {},
          },
        },
      },
    ]);
    const service = createAzureProjectQueryService({ queryGateway });

    await expect(
      service.listProjectDeployments("token-a", {
        subscriptionId: "sub-a",
        resourceGroup: "rg-a",
        accountName: "account-a",
      }),
    ).resolves.toEqual([
      {
        name: "deploy-a",
        reasoningEffortOptions: ["minimal", "low", "medium", "high"],
      },
    ]);
  });
});

describe("isLikelyAzureAuthError", () => {
  it("returns true for Azure login/authentication failures", () => {
    expect(
      isLikelyAzureAuthError(
        new Error(
          "AuthenticationRequiredError: Automatic authentication has been disabled.",
        ),
      ),
    ).toBe(true);
    expect(
      isLikelyAzureAuthError(
        new Error("Request failed with status code 401 Unauthorized."),
      ),
    ).toBe(true);
  });

  it("returns false for non-auth errors", () => {
    expect(
      isLikelyAzureAuthError(
        new Error("Failed to load Azure project data: Bad gateway."),
      ),
    ).toBe(false);
    expect(isLikelyAzureAuthError(new Error("Network timeout"))).toBe(false);
    expect(isLikelyAzureAuthError("invalid")).toBe(false);
  });
});
