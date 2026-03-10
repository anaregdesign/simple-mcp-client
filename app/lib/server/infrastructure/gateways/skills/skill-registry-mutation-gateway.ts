import type {
  WorkspaceSkillRegistryMutationGateway,
} from "~/lib/domain/repositories/workspace-skill-registry-mutation-gateway";
import {
  deleteInstalledSkillFromRegistry,
} from "~/lib/server/infrastructure/gateways/skills/skill-registry-delete";
import {
  installSkillFromRegistry,
} from "~/lib/server/infrastructure/gateways/skills/skill-registry-install";

export function createWorkspaceSkillRegistryMutationGateway(): WorkspaceSkillRegistryMutationGateway {
  return {
    installSkill: installSkillFromRegistry,
    deleteSkill: deleteInstalledSkillFromRegistry,
  };
}
