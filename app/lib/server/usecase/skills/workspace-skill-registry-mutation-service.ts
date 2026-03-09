import type { SkillRegistryId } from "~/lib/contracts/skills/registry";
import type {
  WorkspaceSkillRegistryMutationGateway,
} from "~/lib/domain/repositories/workspace-skill-registry-mutation-gateway";
import type {
  SkillDiscoveryResult,
  WorkspaceSkillService,
} from "~/lib/server/usecase/skills/workspace-skill-service";

type WorkspaceSkillRegistryMutationWorkspaceSkillService = Pick<
  WorkspaceSkillService,
  "discoverWorkspaceSkills" | "syncWorkspaceSkillMasters"
>;

type WorkspaceSkillRegistryMutationOptions = {
  userId: number;
  registryId: SkillRegistryId;
  skillName: string;
};

export type WorkspaceSkillRegistryMutationResult =
  | {
      operation: "installed" | "updated" | "unchanged";
      skillName: string;
      discoveryResult: SkillDiscoveryResult;
    }
  | {
      operation: "removed" | "missing";
      skillName: string;
      discoveryResult: SkillDiscoveryResult;
    };

export class WorkspaceSkillRegistryMutationService {
  constructor(
    private readonly registryGateway: WorkspaceSkillRegistryMutationGateway,
    private readonly workspaceSkillService: WorkspaceSkillRegistryMutationWorkspaceSkillService,
  ) {}

  async installSkill(
    options: WorkspaceSkillRegistryMutationOptions,
  ): Promise<WorkspaceSkillRegistryMutationResult> {
    const result = await this.registryGateway.installSkill({
      workspaceUserId: options.userId,
      registryId: options.registryId,
      skillName: options.skillName,
    });

    return {
      operation: result.operation,
      skillName: result.skillName,
      discoveryResult: await reconcileWorkspaceSkills(
        this.workspaceSkillService,
        options.userId,
      ),
    };
  }

  async deleteSkill(
    options: WorkspaceSkillRegistryMutationOptions,
  ): Promise<WorkspaceSkillRegistryMutationResult> {
    const result = await this.registryGateway.deleteSkill({
      workspaceUserId: options.userId,
      registryId: options.registryId,
      skillName: options.skillName,
    });

    return {
      operation: result.removed ? "removed" : "missing",
      skillName: result.skillName,
      discoveryResult: await reconcileWorkspaceSkills(
        this.workspaceSkillService,
        options.userId,
      ),
    };
  }
}

export function createWorkspaceSkillRegistryMutationService(options: {
  registryGateway: WorkspaceSkillRegistryMutationGateway;
  workspaceSkillService: WorkspaceSkillRegistryMutationWorkspaceSkillService;
}): WorkspaceSkillRegistryMutationService {
  return new WorkspaceSkillRegistryMutationService(
    options.registryGateway,
    options.workspaceSkillService,
  );
}

async function reconcileWorkspaceSkills(
  workspaceSkillService: WorkspaceSkillRegistryMutationWorkspaceSkillService,
  userId: number,
): Promise<SkillDiscoveryResult> {
  const discoveryResult = await workspaceSkillService.discoverWorkspaceSkills({
    userId,
    forceRefresh: true,
  });

  await workspaceSkillService.syncWorkspaceSkillMasters({
    userId,
    skills: discoveryResult.skills,
    registries: discoveryResult.registries,
  });

  return discoveryResult;
}
