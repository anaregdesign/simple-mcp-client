/**
 * API route module for /api/skills/registries/:registryId/skills/*.
 */
import {
  handleWorkspaceSkillRegistryMutationAction,
  handleWorkspaceSkillRegistryMutationLoader,
} from "~/lib/server/http/skills/workspace-skill-registry-mutation-action";
import {
  installGlobalServerErrorLogging,
  logServerRouteEvent,
} from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import {
  createWorkspaceSkillRegistryMutationGateway,
} from "~/lib/server/infrastructure/gateways/skills/skill-registry-gateway";
import {
  createWorkspaceSkillDiscoveryGateway,
} from "~/lib/server/infrastructure/gateways/skills/skill-discovery-gateway";
import {
  createWorkspaceSkillService,
} from "~/lib/server/usecase/skills/workspace-skill-service";
import {
  createWorkspaceSkillProfilePersistenceRepository,
} from "~/lib/server/infrastructure/repositories/workspace-skill-profile-persistence-repository";
import {
  createWorkspaceSkillRegistryMutationService,
} from "~/lib/server/usecase/skills/workspace-skill-registry-mutation-service";
import type { Route } from "./+types/api.skills.registries.$registryId.skills.$";

function getWorkspaceSkillService() {
  return createWorkspaceSkillService({
    repository: createWorkspaceSkillProfilePersistenceRepository(),
    discoveryGateway: createWorkspaceSkillDiscoveryGateway(),
  });
}

function getWorkspaceSkillRegistryMutationService() {
  return createWorkspaceSkillRegistryMutationService({
    registryGateway: createWorkspaceSkillRegistryMutationGateway(),
    workspaceSkillService: getWorkspaceSkillService(),
  });
}

export function loader() {
  installGlobalServerErrorLogging();
  return handleWorkspaceSkillRegistryMutationLoader();
}

export async function action({ request, params }: Route.ActionArgs) {
  installGlobalServerErrorLogging();
  return handleWorkspaceSkillRegistryMutationAction({
    request,
    registryId: params.registryId,
    skillName: params["*"],
    workspaceSkillRegistryMutationService:
      getWorkspaceSkillRegistryMutationService(),
  });
}
