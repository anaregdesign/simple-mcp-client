import { describe, expect, it, vi } from "vitest";
import type { WorkspaceSkillDiscoveryGateway } from "~/lib/domain/repositories/workspace-skill-discovery-gateway";
import type { WorkspaceSkillProfileRepository } from "~/lib/domain/repositories/workspace-skill-profile-repository";
import { createWorkspaceSkillService } from "~/lib/server/usecase/skills/workspace-skill-service";

function createRepositoryMock(): WorkspaceSkillProfileRepository {
  return {
    readByUserId: vi.fn(),
    syncSkillMasters: vi.fn(),
  };
}

function createDiscoveryGatewayMock(): WorkspaceSkillDiscoveryGateway {
  return {
    discoverCatalog: vi.fn(),
    discoverRegistries: vi.fn(),
  };
}

describe("WorkspaceSkillService", () => {
  it("aggregates discovery results from the injected gateway", async () => {
    const repository = createRepositoryMock();
    const discoveryGateway = createDiscoveryGatewayMock();
    vi.mocked(discoveryGateway.discoverCatalog).mockResolvedValue({
      skills: [],
      warnings: ["catalog warning"],
    });
    vi.mocked(discoveryGateway.discoverRegistries).mockResolvedValue({
      catalogs: [],
      warnings: ["registry warning"],
    });

    const service = createWorkspaceSkillService({
      repository,
      discoveryGateway,
    });
    const result = await service.discoverWorkspaceSkills({
      userId: 10,
      forceRefresh: true,
    });

    expect(result).toEqual({
      skills: [],
      registries: [],
      skillWarnings: ["catalog warning"],
      registryWarnings: ["registry warning"],
      warnings: ["catalog warning", "registry warning"],
    });
  });

  it("delegates profile sync to the injected repository", async () => {
    const repository = createRepositoryMock();
    const discoveryGateway = createDiscoveryGatewayMock();
    vi.mocked(repository.syncSkillMasters).mockResolvedValue({
      workspaceSkillProfileCount: 2,
      workspaceSkillRegistryProfileCount: 1,
    });

    const service = createWorkspaceSkillService({
      repository,
      discoveryGateway,
    });
    const result = await service.syncWorkspaceSkillMasters({
      userId: 10,
      skills: [],
      registries: [],
    });

    expect(result).toEqual({
      workspaceSkillProfileCount: 2,
      workspaceSkillRegistryProfileCount: 1,
    });
    expect(repository.syncSkillMasters).toHaveBeenCalledWith({
      userId: 10,
      skills: [],
      registries: [],
    });
  });
});
