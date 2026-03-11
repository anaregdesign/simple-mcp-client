import { describe, expect, it } from "vitest";
import { shouldShowAzureAuthPendingPanel } from "./selectors";

describe("shouldShowAzureAuthPendingPanel", () => {
  it("returns true while the initial Azure auth state is still loading", () => {
    expect(
      shouldShowAzureAuthPendingPanel({
        isLoadingAzureConnections: true,
        isAzureAuthRequired: false,
        activeAzurePrincipal: null,
        azureConnectionCount: 0,
        azureConnectionError: null,
      }),
    ).toBe(true);
  });

  it("returns false after auth is confirmed as required", () => {
    expect(
      shouldShowAzureAuthPendingPanel({
        isLoadingAzureConnections: false,
        isAzureAuthRequired: true,
        activeAzurePrincipal: null,
        azureConnectionCount: 0,
        azureConnectionError: null,
      }),
    ).toBe(false);
  });

  it("returns false when an authenticated catalog is already available", () => {
    expect(
      shouldShowAzureAuthPendingPanel({
        isLoadingAzureConnections: true,
        isAzureAuthRequired: false,
        activeAzurePrincipal: {
          tenantId: "tenant-a",
          principalId: "principal-a",
        },
        azureConnectionCount: 1,
        azureConnectionError: null,
      }),
    ).toBe(false);
  });

  it("returns false when the initial load failed with a non-auth error", () => {
    expect(
      shouldShowAzureAuthPendingPanel({
        isLoadingAzureConnections: false,
        isAzureAuthRequired: false,
        activeAzurePrincipal: null,
        azureConnectionCount: 0,
        azureConnectionError: "Failed to load Azure projects.",
      }),
    ).toBe(false);
  });
});
