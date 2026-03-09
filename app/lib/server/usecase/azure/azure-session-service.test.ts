import { beforeEach, describe, expect, it, vi } from "vitest";
import { AZURE_ARM_SCOPE } from "~/lib/constants/azure";
const {
  authenticateAzure,
  getAzureDependencies,
  resetAzureDependencies,
} = vi.hoisted(() => {
  const authenticateAzure = vi.fn(async () => undefined);
  const getAzureDependencies = vi.fn(() => ({
    getCredential: vi.fn(),
    authenticateAzure,
    getAzureBearerToken: vi.fn(),
    getAzureOpenAIClient: vi.fn(),
  }));

  return {
    authenticateAzure,
    getAzureDependencies,
    resetAzureDependencies: vi.fn(),
  };
});

vi.mock("~/lib/server/infrastructure/azure/dependencies", () => ({
  getAzureDependencies,
  resetAzureDependencies,
}));

import { AzureSessionService } from "./azure-session-service";

describe("azure-session-service", () => {
  beforeEach(() => {
    authenticateAzure.mockReset();
    authenticateAzure.mockResolvedValue(undefined);
    getAzureDependencies.mockClear();
    resetAzureDependencies.mockReset();
  });

  it("starts a generic login flow when no tenant was requested", async () => {
    const service = new AzureSessionService();

    await service.startSession("");

    expect(resetAzureDependencies).toHaveBeenCalledTimes(1);
    expect(getAzureDependencies).toHaveBeenCalledTimes(1);
    expect(authenticateAzure).toHaveBeenCalledTimes(1);
    expect(authenticateAzure).toHaveBeenCalledWith(AZURE_ARM_SCOPE);
  });

  it("pins login to the requested tenant when a tenant was provided", async () => {
    const service = new AzureSessionService();

    await service.startSession(" tenant-a ");

    expect(authenticateAzure).toHaveBeenCalledWith(
      AZURE_ARM_SCOPE,
      "tenant-a",
    );
  });
});
