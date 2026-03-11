import { describe, expect, it, vi } from "vitest";
import type { AzureArmAccessGateway } from "~/lib/domain/repositories/azure-arm-access-gateway";
import {
  createWorkspaceBootstrapService,
} from "~/lib/server/usecase/workspace/workspace-bootstrap-service";

function createAzureArmAccessGatewayMock(): AzureArmAccessGateway {
  return {
    getArmAccessToken: vi.fn(),
    resolveAzurePrincipalProfile: vi.fn(),
  };
}

describe("WorkspaceBootstrapService", () => {
  it("returns null when Azure ARM access is unavailable", async () => {
    const azureArmAccessGateway = createAzureArmAccessGatewayMock();
    vi.mocked(azureArmAccessGateway.getArmAccessToken).mockResolvedValue({
      ok: false,
    });
    const service = createWorkspaceBootstrapService({
      azureArmAccessGateway,
      azureProjectQueryService: {
        loadAzureProjectsWithFallback: vi.fn(),
        loadAzureTenantsWithFallback: vi.fn(),
        listProjectDeployments: vi.fn(),
      } as never,
      azureSelectionService: {
        readStoredSelection: vi.fn(),
        saveSelection: vi.fn(),
      } as never,
      mcpServerProfileService: {
        ensureDefaultMcpServersForUser: vi.fn(),
      } as never,
      threadQueryService: {
        readUserThreads: vi.fn(),
      } as never,
      workspaceSkillService: {
        discoverWorkspaceSkills: vi.fn(),
      } as never,
    });

    const result = await service.loadWorkspaceBootstrap({
      user: {
        id: 1,
        tenantId: "tenant-a",
        principalId: "principal-a",
      },
    });

    expect(result).toBeNull();
  });

  it("loads workspace bootstrap data through injected gateways and services", async () => {
    const azureArmAccessGateway = createAzureArmAccessGatewayMock();
    vi.mocked(azureArmAccessGateway.getArmAccessToken).mockResolvedValue({
      ok: true,
      token: "token-1",
      tenantId: "tenant-a",
      principalId: "principal-a",
      displayName: "User A",
      principalName: "user@example.com",
      principalType: "user",
    });
    vi.mocked(azureArmAccessGateway.resolveAzurePrincipalProfile).mockResolvedValue({
      tenantId: "tenant-a",
      principalId: "principal-a",
      displayName: "User A",
      principalName: "user@example.com",
      principalType: "user",
    });
    const azureProjectQueryService = {
      loadAzureProjectsWithFallback: vi.fn(async () => []),
      loadAzureTenantsWithFallback: vi.fn(async () => []),
      listProjectDeployments: vi.fn(async () => []),
    };

    const service = createWorkspaceBootstrapService({
      azureArmAccessGateway,
      azureProjectQueryService,
      azureSelectionService: {
        readStoredSelection: vi.fn(async () => null),
        saveSelection: vi.fn(),
      } as never,
      mcpServerProfileService: {
        ensureDefaultMcpServersForUser: vi.fn(async () => undefined),
        readWorkspaceMcpServerProfiles: vi.fn(async () => []),
      } as never,
      threadQueryService: {
        readUserThreads: vi.fn(async () => []),
      } as never,
      workspaceSkillService: {
        discoverWorkspaceSkills: vi.fn(async () => ({
          skills: [],
          registries: [],
          skillWarnings: [],
          registryWarnings: [],
          warnings: [],
        })),
      } as never,
    });

    const result = await service.loadWorkspaceBootstrap({
      user: {
        id: 1,
        tenantId: "tenant-a",
        principalId: "principal-a",
      },
    });

    expect(result).toEqual({
      tenantId: "tenant-a",
      principalId: "principal-a",
      principal: {
        tenantId: "tenant-a",
        principalId: "principal-a",
        displayName: "User A",
        principalName: "user@example.com",
        principalType: "user",
      },
      azureProjects: [],
      azureTenants: [],
      azureSelection: null,
      azureDeploymentsByProjectId: {},
      threads: [],
      workspaceMcpServerProfiles: [],
      skills: [],
      skillRegistries: [],
      skillWarnings: [],
      registryWarnings: [],
      warnings: [],
      desktopStatus: null,
    });
    expect(azureProjectQueryService.loadAzureProjectsWithFallback).toHaveBeenCalledOnce();
    expect(azureProjectQueryService.loadAzureTenantsWithFallback).toHaveBeenCalledOnce();
  });
});
