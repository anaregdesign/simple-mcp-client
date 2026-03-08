/**
 * Tests for Home controller Azure runtime helpers.
 */
import { describe, expect, it } from "vitest";
import {
  resolveAzureTenantOptions,
  resolveInitialAzureProjectId,
} from "~/lib/home/controller/azure-runtime";

describe("resolveAzureTenantOptions", () => {
  it("deduplicates tenants and appends active tenant when missing", () => {
    const options = resolveAzureTenantOptions(
      [
        {
          tenantId: " tenant-a ",
          displayName: "Alpha Tenant",
          defaultDomain: "alpha.example.com",
        },
        {
          tenantId: "TENANT-A",
          displayName: "Duplicate",
          defaultDomain: "duplicate.example.com",
        },
        {
          tenantId: "tenant-b",
          displayName: "",
          defaultDomain: "beta.example.com",
        },
      ],
      "tenant-c",
    );

    expect(options).toEqual([
      {
        tenantId: "tenant-c",
        displayName: "tenant-c",
        defaultDomain: "",
      },
      {
        tenantId: "tenant-a",
        displayName: "Alpha Tenant",
        defaultDomain: "alpha.example.com",
      },
      {
        tenantId: "tenant-b",
        displayName: "beta.example.com",
        defaultDomain: "beta.example.com",
      },
    ]);
  });

  it("prioritizes the active tenant when already present", () => {
    const options = resolveAzureTenantOptions(
      [
        {
          tenantId: "tenant-a",
          displayName: "Alpha Tenant",
          defaultDomain: "alpha.example.com",
        },
        {
          tenantId: "tenant-b",
          displayName: "Beta Tenant",
          defaultDomain: "beta.example.com",
        },
      ],
      "tenant-b",
    );

    expect(options[0]?.tenantId).toBe("tenant-b");
    expect(options).toHaveLength(2);
  });
});

describe("resolveInitialAzureProjectId", () => {
  const knownProjectIds = new Set(["project-a", "project-b"]);

  it("selects current project when available", () => {
    expect(
      resolveInitialAzureProjectId({
        knownProjectIds,
        currentProjectId: " project-b ",
        preferredProjectId: "project-a",
        fallbackProjectId: "",
        defaultProjectId: "project-a",
      }),
    ).toBe("project-b");
  });

  it("falls back to preferred then fallback project", () => {
    expect(
      resolveInitialAzureProjectId({
        knownProjectIds,
        currentProjectId: "unknown",
        preferredProjectId: "project-a",
        fallbackProjectId: "project-b",
        defaultProjectId: "project-b",
      }),
    ).toBe("project-a");

    expect(
      resolveInitialAzureProjectId({
        knownProjectIds,
        currentProjectId: "unknown",
        preferredProjectId: "missing",
        fallbackProjectId: "project-b",
        defaultProjectId: "project-a",
      }),
    ).toBe("project-b");
  });

  it("returns default project when no candidate exists", () => {
    expect(
      resolveInitialAzureProjectId({
        knownProjectIds,
        currentProjectId: "unknown",
        preferredProjectId: "missing",
        fallbackProjectId: "",
        defaultProjectId: "project-a",
      }),
    ).toBe("project-a");
  });
});
