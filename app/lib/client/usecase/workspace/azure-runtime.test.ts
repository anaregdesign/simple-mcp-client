/**
 * Tests for Client controller Azure runtime helpers.
 */
import { describe, expect, it } from "vitest";
import {
  buildAzureProjectsLoadResult,
  isAzureProjectsLoadReady,
  resolveAzureAuthRequiredState,
  resolveAzureTenantOptions,
  resolveInitialAzureProjectId,
  shouldUseCachedAzureProjectCatalog,
} from "~/lib/client/usecase/workspace/azure-runtime";

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

describe("shouldUseCachedAzureProjectCatalog", () => {
  it("uses cache when not forcing reload and auth is healthy", () => {
    expect(
      shouldUseCachedAzureProjectCatalog({
        forceReload: false,
        isAzureAuthRequired: false,
      }),
    ).toBe(true);
  });

  it("skips cache during auth recovery polling", () => {
    expect(
      shouldUseCachedAzureProjectCatalog({
        forceReload: false,
        isAzureAuthRequired: true,
      }),
    ).toBe(false);
  });

  it("skips cache when force reload is requested", () => {
    expect(
      shouldUseCachedAzureProjectCatalog({
        forceReload: true,
        isAzureAuthRequired: false,
      }),
    ).toBe(false);
  });
});

describe("resolveAzureAuthRequiredState", () => {
  it("keeps auth lock during passive background success", () => {
    expect(
      resolveAzureAuthRequiredState({
        currentAuthRequired: true,
        nextAuthRequired: false,
        source: "background_success",
      }),
    ).toBe(true);
  });

  it("allows projects response to unlock auth", () => {
    expect(
      resolveAzureAuthRequiredState({
        currentAuthRequired: true,
        nextAuthRequired: false,
        source: "projects_response",
      }),
    ).toBe(false);
  });

  it("allows interactive login to unlock auth", () => {
    expect(
      resolveAzureAuthRequiredState({
        currentAuthRequired: true,
        nextAuthRequired: false,
        source: "interactive_login",
      }),
    ).toBe(false);
  });
});

describe("buildAzureProjectsLoadResult", () => {
  it("marks auth required when auth flag is true", () => {
    expect(
      buildAzureProjectsLoadResult({
        authRequired: true,
        preferredTenantId: "tenant-a",
        resolvedTenantId: "tenant-a",
      }),
    ).toEqual({
      authRequired: true,
      tenantSwitchPending: false,
    });
  });

  it("marks tenant switch pending when resolved tenant mismatches preferred tenant", () => {
    expect(
      buildAzureProjectsLoadResult({
        authRequired: false,
        preferredTenantId: "tenant-a",
        resolvedTenantId: "tenant-b",
      }),
    ).toEqual({
      authRequired: false,
      tenantSwitchPending: true,
    });
  });

  it("marks ready state when auth is healthy and tenant is aligned", () => {
    expect(
      buildAzureProjectsLoadResult({
        authRequired: false,
        preferredTenantId: "tenant-a",
        resolvedTenantId: "tenant-a",
      }),
    ).toEqual({
      authRequired: false,
      tenantSwitchPending: false,
    });
  });
});

describe("isAzureProjectsLoadReady", () => {
  it("returns true only when both auth required and tenant pending are false", () => {
    expect(
      isAzureProjectsLoadReady({
        authRequired: false,
        tenantSwitchPending: false,
      }),
    ).toBe(true);
    expect(
      isAzureProjectsLoadReady({
        authRequired: true,
        tenantSwitchPending: false,
      }),
    ).toBe(false);
    expect(
      isAzureProjectsLoadReady({
        authRequired: false,
        tenantSwitchPending: true,
      }),
    ).toBe(false);
  });
});
