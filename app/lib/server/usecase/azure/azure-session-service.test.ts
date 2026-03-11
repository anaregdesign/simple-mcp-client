import { beforeEach, describe, expect, it, vi } from "vitest";
import { AZURE_ARM_SCOPE } from "~/lib/constants/azure";
import type { AzureSessionGateway } from "~/lib/domain/repositories/azure-session-gateway";
import { AzureSessionService } from "./azure-session-service";

function createGatewayMock(): AzureSessionGateway {
  return {
    authenticate: vi.fn(async () => undefined),
    reset: vi.fn(),
  };
}

describe("azure-session-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts a generic login flow when no tenant was requested", async () => {
    const gateway = createGatewayMock();
    const service = new AzureSessionService(gateway);

    await service.startSession("");

    expect(gateway.reset).toHaveBeenCalledTimes(1);
    expect(gateway.authenticate).toHaveBeenCalledTimes(1);
    expect(gateway.authenticate).toHaveBeenCalledWith(AZURE_ARM_SCOPE);
  });

  it("pins login to the requested tenant when a tenant was provided", async () => {
    const gateway = createGatewayMock();
    const service = new AzureSessionService(gateway);

    await service.startSession(" tenant-a ");

    expect(gateway.authenticate).toHaveBeenCalledWith(
      AZURE_ARM_SCOPE,
      "tenant-a",
    );
  });
});
