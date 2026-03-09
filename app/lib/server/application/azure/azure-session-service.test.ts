import { beforeEach, describe, expect, it, vi } from "vitest";
import { AZURE_ARM_SCOPE } from "~/lib/constants/azure";
import { AZURE_COGNITIVE_SERVICES_SCOPE } from "~/lib/server/infrastructure/azure/dependencies";

const {
  authenticateAzure,
  getAzureBearerToken,
  getAzureDependencies,
  resetAzureDependencies,
  readAzureArmUserContext,
  getOrCreateUserByIdentity,
  ensureDefaultMcpServersForUser,
} = vi.hoisted(() => {
  const authenticateAzure = vi.fn(async () => undefined);
  const getAzureBearerToken = vi.fn(async () => "cognitive-token");
  const getAzureDependencies = vi.fn(() => ({
    getCredential: vi.fn(),
    authenticateAzure,
    getAzureBearerToken,
    getAzureOpenAIClient: vi.fn(),
  }));

  return {
    authenticateAzure,
    getAzureBearerToken,
    getAzureDependencies,
    resetAzureDependencies: vi.fn(),
    readAzureArmUserContext: vi.fn(),
    getOrCreateUserByIdentity: vi.fn(),
    ensureDefaultMcpServersForUser: vi.fn(async () => undefined),
  };
});

vi.mock("~/lib/server/infrastructure/azure/dependencies", () => ({
  AZURE_COGNITIVE_SERVICES_SCOPE:
    "https://cognitiveservices.azure.com/.default",
  getAzureDependencies,
  resetAzureDependencies,
}));

vi.mock("~/lib/server/auth/azure-user", () => ({
  readAzureArmUserContext,
}));

vi.mock("~/lib/server/persistence/user", () => ({
  getOrCreateUserByIdentity,
}));

vi.mock("~/lib/server/application/mcp/mcp-server-profile-service", () => ({
  ensureDefaultMcpServersForUser,
}));

import { AzureSessionService } from "./azure-session-service";

describe("azure-session-service", () => {
  beforeEach(() => {
    authenticateAzure.mockReset();
    authenticateAzure.mockResolvedValue(undefined);
    getAzureBearerToken.mockReset();
    getAzureBearerToken.mockResolvedValue("cognitive-token");
    getAzureDependencies.mockClear();
    resetAzureDependencies.mockReset();
    readAzureArmUserContext.mockReset();
    readAzureArmUserContext.mockResolvedValue({
      tenantId: "tenant-b",
      principalId: "principal-b",
    });
    getOrCreateUserByIdentity.mockReset();
    getOrCreateUserByIdentity.mockResolvedValue({
      id: 42,
      tenantId: "tenant-b",
      principalId: "principal-b",
    });
    ensureDefaultMcpServersForUser.mockReset();
    ensureDefaultMcpServersForUser.mockResolvedValue(undefined);
  });

  it("starts a generic login flow when no tenant was requested", async () => {
    const service = new AzureSessionService();

    const result = await service.startSession("");

    expect(resetAzureDependencies).toHaveBeenCalledTimes(1);
    expect(getAzureDependencies).toHaveBeenCalledTimes(2);
    expect(authenticateAzure).toHaveBeenCalledTimes(1);
    expect(authenticateAzure).toHaveBeenCalledWith(AZURE_ARM_SCOPE);
    expect(readAzureArmUserContext).toHaveBeenCalledWith(
      getAzureDependencies.mock.results[0]?.value,
      "",
    );
    expect(getAzureBearerToken).toHaveBeenCalledWith(
      AZURE_COGNITIVE_SERVICES_SCOPE,
      "tenant-b",
    );
    expect(getOrCreateUserByIdentity).toHaveBeenCalledWith({
      tenantId: "tenant-b",
      principalId: "principal-b",
    });
    expect(ensureDefaultMcpServersForUser).toHaveBeenCalledWith(42);
    expect(result).toEqual({
      tenantId: "tenant-b",
      principalId: "principal-b",
      userId: 42,
    });
  });

  it("pins login to the requested tenant when a tenant was provided", async () => {
    readAzureArmUserContext.mockResolvedValueOnce({
      tenantId: "tenant-a",
      principalId: "principal-a",
    });
    getOrCreateUserByIdentity.mockResolvedValueOnce({
      id: 7,
      tenantId: "tenant-a",
      principalId: "principal-a",
    });
    const service = new AzureSessionService();

    await service.startSession(" tenant-a ");

    expect(authenticateAzure).toHaveBeenCalledWith(
      AZURE_ARM_SCOPE,
      "tenant-a",
    );
    expect(readAzureArmUserContext).toHaveBeenCalledWith(
      getAzureDependencies.mock.results[0]?.value,
      "tenant-a",
    );
  });
});
