import {
  createWorkspaceSkillRegistryMutationGateway,
} from "~/lib/server/infrastructure/gateways/skills/skill-registry-gateway";
import {
  createWorkspaceSkillDiscoveryGateway,
} from "~/lib/server/infrastructure/gateways/skills/skill-discovery-gateway";
import {
  createWorkspaceSkillProfilePersistenceRepository,
} from "~/lib/server/infrastructure/repositories/workspace-skill-profile-persistence-repository";
import {
  createWorkspaceSkillService,
} from "~/lib/server/usecase/skills/workspace-skill-service";
import {
  createWorkspaceSkillRegistryMutationService,
} from "~/lib/server/usecase/skills/workspace-skill-registry-mutation-service";

export function createWorkspaceSkillServiceWithInfrastructure() {
  return createWorkspaceSkillService({
    repository: createWorkspaceSkillProfilePersistenceRepository(),
    discoveryGateway: createWorkspaceSkillDiscoveryGateway(),
  });
}

export function createWorkspaceSkillRegistryMutationServiceWithInfrastructure() {
  return createWorkspaceSkillRegistryMutationService({
    registryGateway: createWorkspaceSkillRegistryMutationGateway(),
    workspaceSkillService: createWorkspaceSkillServiceWithInfrastructure(),
  });
}
