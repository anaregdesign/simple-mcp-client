/**
 * API route module for /api/skills.
 */
import { handleSkillsCollectionLoader } from "~/lib/server/infrastructure/skills/skill-discovery-loader";
import {
  authRequiredResponse,
  methodNotAllowedResponse,
} from "~/lib/server/infrastructure/http/route-transport";
import { readAuthenticatedUser } from "~/lib/server/infrastructure/auth/read-authenticated-user";
import {
  installGlobalServerErrorLogging,
} from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import {
  createWorkspaceSkillServiceWithInfrastructure,
} from "~/lib/server/infrastructure/skills/workspace-skill-service-factory";
import type { Route } from "./+types/api.skills";
const SKILLS_COLLECTION_ALLOWED_METHODS = ["GET"] as const;

export async function loader({ request }: Route.LoaderArgs) {
  installGlobalServerErrorLogging();

  if (request.method !== "GET") {
    return methodNotAllowedResponse(SKILLS_COLLECTION_ALLOWED_METHODS);
  }

  const user = await readAuthenticatedUser();
  if (!user) {
    return authRequiredResponse();
  }

  return handleSkillsCollectionLoader({
    request,
    userId: user.id,
    workspaceSkillService: createWorkspaceSkillServiceWithInfrastructure(),
  });
}
