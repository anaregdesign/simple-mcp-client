/**
 * Workspace Skill application service module.
 */
import type {
  SkillCatalogEntry,
  SkillRegistryCatalog,
} from "~/lib/contracts/skills/types";
import type {
  WorkspaceSkillProfilesData,
} from "~/lib/contracts/skills/workspace-skill-profiles";
import type {
  WorkspaceSkillDiscoveryGateway,
} from "~/lib/domain/repositories/workspace-skill-discovery-gateway";
import type {
  SyncWorkspaceSkillMastersResult,
  WorkspaceSkillProfileRepository,
} from "~/lib/domain/repositories/workspace-skill-profile-repository";

export type SkillDiscoveryResult = {
  skills: SkillCatalogEntry[];
  registries: SkillRegistryCatalog[];
  skillWarnings: string[];
  registryWarnings: string[];
  warnings: string[];
};

export class WorkspaceSkillService {
  constructor(
    private readonly repository: WorkspaceSkillProfileRepository,
    private readonly discoveryGateway: WorkspaceSkillDiscoveryGateway,
  ) {}

  async readWorkspaceSkillProfiles(userId: number): Promise<WorkspaceSkillProfilesData> {
    return this.repository.readByUserId(userId);
  }

  async discoverWorkspaceSkills(options: {
    userId: number;
    forceRefresh: boolean;
  }): Promise<SkillDiscoveryResult> {
    const [catalogDiscovery, registryDiscovery] = await Promise.all([
      this.discoveryGateway.discoverCatalog({ workspaceUserId: options.userId }),
      this.discoveryGateway.discoverRegistries({
        workspaceUserId: options.userId,
        forceRefresh: options.forceRefresh,
      }),
    ]);

    return {
      skills: catalogDiscovery.skills,
      registries: registryDiscovery.catalogs,
      skillWarnings: catalogDiscovery.warnings,
      registryWarnings: registryDiscovery.warnings,
      warnings: [...catalogDiscovery.warnings, ...registryDiscovery.warnings],
    };
  }

  async syncWorkspaceSkillMasters(options: {
    userId: number;
    skills: SkillCatalogEntry[];
    registries: SkillRegistryCatalog[];
  }): Promise<SyncWorkspaceSkillMastersResult> {
    return this.repository.syncSkillMasters(options);
  }
}

export function createWorkspaceSkillService(options: {
  repository: WorkspaceSkillProfileRepository;
  discoveryGateway: WorkspaceSkillDiscoveryGateway;
}): WorkspaceSkillService {
  return new WorkspaceSkillService(
    options.repository,
    options.discoveryGateway,
  );
}
