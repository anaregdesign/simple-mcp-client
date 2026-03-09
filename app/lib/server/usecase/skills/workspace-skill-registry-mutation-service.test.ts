import { describe, expect, it, vi } from "vitest";
import type {
  WorkspaceSkillRegistryMutationGateway,
} from "~/lib/domain/repositories/workspace-skill-registry-mutation-gateway";
import type { WorkspaceSkillService } from "~/lib/server/usecase/skills/workspace-skill-service";
import {
  createWorkspaceSkillRegistryMutationService,
} from "~/lib/server/usecase/skills/workspace-skill-registry-mutation-service";

function createRegistryGatewayMock(): WorkspaceSkillRegistryMutationGateway {
  return {
    installSkill: vi.fn(),
    deleteSkill: vi.fn(),
  };
}

function createWorkspaceSkillServiceMock(): Pick<
  WorkspaceSkillService,
  "discoverWorkspaceSkills" | "syncWorkspaceSkillMasters"
> {
  return {
    discoverWorkspaceSkills: vi.fn(),
    syncWorkspaceSkillMasters: vi.fn(),
  };
}

describe("WorkspaceSkillRegistryMutationService", () => {
  it("installs a registry skill and reconciles workspace skill snapshots", async () => {
    const registryGateway = createRegistryGatewayMock();
    const workspaceSkillService = createWorkspaceSkillServiceMock();
    vi.mocked(registryGateway.installSkill).mockResolvedValue({
      skillName: "gh-fix-ci",
      installLocation: "/tmp/gh-fix-ci/SKILL.md",
      operation: "installed",
    });
    vi.mocked(workspaceSkillService.discoverWorkspaceSkills).mockResolvedValue({
      skills: [],
      registries: [],
      skillWarnings: [],
      registryWarnings: [],
      warnings: [],
    });
    vi.mocked(workspaceSkillService.syncWorkspaceSkillMasters).mockResolvedValue({
      workspaceSkillProfileCount: 1,
      workspaceSkillRegistryProfileCount: 1,
    });

    const service = createWorkspaceSkillRegistryMutationService({
      registryGateway,
      workspaceSkillService,
    });
    const result = await service.installSkill({
      userId: 10,
      registryId: "openai_curated",
      skillName: "gh-fix-ci",
    });

    expect(result).toEqual({
      operation: "installed",
      skillName: "gh-fix-ci",
      discoveryResult: {
        skills: [],
        registries: [],
        skillWarnings: [],
        registryWarnings: [],
        warnings: [],
      },
    });
    expect(workspaceSkillService.discoverWorkspaceSkills).toHaveBeenCalledWith({
      userId: 10,
      forceRefresh: true,
    });
    expect(workspaceSkillService.syncWorkspaceSkillMasters).toHaveBeenCalledWith({
      userId: 10,
      skills: [],
      registries: [],
    });
  });

  it("deletes a registry skill and keeps reconcile logic in the use case", async () => {
    const registryGateway = createRegistryGatewayMock();
    const workspaceSkillService = createWorkspaceSkillServiceMock();
    vi.mocked(registryGateway.deleteSkill).mockResolvedValue({
      skillName: "gh-fix-ci",
      installLocation: "/tmp/gh-fix-ci/SKILL.md",
      removed: false,
    });
    vi.mocked(workspaceSkillService.discoverWorkspaceSkills).mockResolvedValue({
      skills: [],
      registries: [],
      skillWarnings: ["warning"],
      registryWarnings: [],
      warnings: ["warning"],
    });
    vi.mocked(workspaceSkillService.syncWorkspaceSkillMasters).mockResolvedValue({
      workspaceSkillProfileCount: 0,
      workspaceSkillRegistryProfileCount: 0,
    });

    const service = createWorkspaceSkillRegistryMutationService({
      registryGateway,
      workspaceSkillService,
    });
    const result = await service.deleteSkill({
      userId: 10,
      registryId: "openai_curated",
      skillName: "gh-fix-ci",
    });

    expect(result).toEqual({
      operation: "missing",
      skillName: "gh-fix-ci",
      discoveryResult: {
        skills: [],
        registries: [],
        skillWarnings: ["warning"],
        registryWarnings: [],
        warnings: ["warning"],
      },
    });
    expect(workspaceSkillService.discoverWorkspaceSkills).toHaveBeenCalledWith({
      userId: 10,
      forceRefresh: true,
    });
    expect(workspaceSkillService.syncWorkspaceSkillMasters).toHaveBeenCalledWith({
      userId: 10,
      skills: [],
      registries: [],
    });
  });
});
