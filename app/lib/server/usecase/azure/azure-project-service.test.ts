import { describe, expect, it } from "vitest";
import {
  isLikelyAzureAuthError,
} from "~/lib/server/usecase/azure/azure-project-service";

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
