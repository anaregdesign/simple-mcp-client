/**
 * API route module for /api/skills/registries/:registryId/skills/*.
 */
import {
  handleWorkspaceSkillRegistryMutationAction,
  handleWorkspaceSkillRegistryMutationLoader,
} from "~/lib/server/http/skills/workspace-skill-registry-mutation-action";
import {
  installGlobalServerErrorLogging,
} from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import {
  createWorkspaceSkillRegistryMutationServiceWithInfrastructure,
} from "~/lib/server/infrastructure/skills/workspace-skill-service-factory";
import type { Route } from "./+types/api.skills.registries.$registryId.skills.$";

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
      createWorkspaceSkillRegistryMutationServiceWithInfrastructure(),
  });
}
