import {
  structuredAuthRequiredResponse,
  methodNotAllowedResponse,
} from "~/lib/server/http";
import {
  handleWorkspaceSkillProfilesAction,
  handleWorkspaceSkillProfilesLoader,
} from "~/lib/server/http/skills/workspace-skill-profile-action";
import { readAuthenticatedUser } from "~/lib/server/infrastructure/auth/read-authenticated-user";
import {
  installGlobalServerErrorLogging,
} from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import {
  createWorkspaceSkillServiceWithInfrastructure,
} from "~/lib/server/infrastructure/skills/workspace-skill-service-factory";
import type { Route } from "./+types/api.workspace-skill-profiles";

const WORKSPACE_SKILL_PROFILES_ALLOWED_METHODS = ["GET", "PUT"] as const;

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
    workspaceSkillService: createWorkspaceSkillServiceWithInfrastructure(),
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
    workspaceSkillService: createWorkspaceSkillServiceWithInfrastructure(),
  });
}
