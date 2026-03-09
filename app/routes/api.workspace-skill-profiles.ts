import {
  structuredAuthRequiredResponse,
  methodNotAllowedResponse,
} from "~/lib/server/http";
import {
  createWorkspaceSkillService,
} from "~/lib/server/usecase/skills/workspace-skill-service";
import {
  handleWorkspaceSkillProfilesAction,
  handleWorkspaceSkillProfilesLoader,
} from "~/lib/server/http/skills/workspace-skill-profile-action";
import { readAuthenticatedUser } from "~/lib/server/infrastructure/auth/read-authenticated-user";
import {
  createWorkspaceSkillProfilePersistenceRepository,
} from "~/lib/server/infrastructure/repositories/workspace-skill-profile-persistence-repository";
import {
  createWorkspaceSkillDiscoveryGateway,
} from "~/lib/server/infrastructure/gateways/skills/skill-discovery-gateway";
import {
  installGlobalServerErrorLogging,
} from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import type { Route } from "./+types/api.workspace-skill-profiles";

const WORKSPACE_SKILL_PROFILES_ALLOWED_METHODS = ["GET", "PUT"] as const;

function getWorkspaceSkillService() {
  return createWorkspaceSkillService({
    repository: createWorkspaceSkillProfilePersistenceRepository(),
    discoveryGateway: createWorkspaceSkillDiscoveryGateway(),
  });
}

export async function loader({ request }: Route.LoaderArgs) {
  installGlobalServerErrorLogging();

  if (request.method !== "GET") {
    return methodNotAllowedResponse(WORKSPACE_SKILL_PROFILES_ALLOWED_METHODS);
  }

  const user = await readAuthenticatedUser();
  if (!user) {
    return structuredAuthRequiredResponse();
  }

  return handleWorkspaceSkillProfilesLoader({
    request,
    userId: user.id,
    workspaceSkillService: getWorkspaceSkillService(),
  });
}

export async function action({ request }: Route.ActionArgs) {
  installGlobalServerErrorLogging();

  if (request.method !== "PUT") {
    return methodNotAllowedResponse(WORKSPACE_SKILL_PROFILES_ALLOWED_METHODS);
  }

  const user = await readAuthenticatedUser();
  if (!user) {
    return structuredAuthRequiredResponse();
  }

  return handleWorkspaceSkillProfilesAction({
    request,
    userId: user.id,
    workspaceSkillService: getWorkspaceSkillService(),
  });
}
