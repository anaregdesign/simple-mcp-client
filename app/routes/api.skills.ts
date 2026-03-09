/**
 * API route module for /api/skills.
 */
import {
  createWorkspaceSkillService,
  readSkillRegistryRefreshQueryFlag,
  skillsRouteTestUtils,
} from "~/lib/server/usecase/skills/workspace-skill-service";
import {
  createWorkspaceSkillProfilePersistenceRepository,
} from "~/lib/server/infrastructure/repositories/workspace-skill-profile-persistence-repository";
import {
  createWorkspaceSkillDiscoveryGateway,
} from "~/lib/server/infrastructure/gateways/skills/skill-discovery-gateway";
import {
  authRequiredResponse,
  errorResponse,
  methodNotAllowedResponse,
  readErrorMessage,
} from "~/lib/server/http";
import { readAuthenticatedUser } from "~/lib/server/infrastructure/auth/read-authenticated-user";
import {
  installGlobalServerErrorLogging,
  logServerRouteEvent,
} from "~/lib/server/observability/runtime-event-log";
import type { Route } from "./+types/api.skills";

export { skillsRouteTestUtils };

const SKILLS_COLLECTION_ALLOWED_METHODS = ["GET"] as const;

function getWorkspaceSkillService() {
  return createWorkspaceSkillService({
    repository: createWorkspaceSkillProfilePersistenceRepository(),
    discoveryGateway: createWorkspaceSkillDiscoveryGateway(),
  });
}

export async function loader({ request }: Route.LoaderArgs) {
  installGlobalServerErrorLogging();

  if (request.method !== "GET") {
    return methodNotAllowedResponse(SKILLS_COLLECTION_ALLOWED_METHODS);
  }

  const user = await readAuthenticatedUser();
  if (!user) {
    return authRequiredResponse();
  }

  try {
    const forceRefresh = readSkillRegistryRefreshQueryFlag(request.url);
    if (forceRefresh) {
      await logServerRouteEvent({
        request,
        route: "/api/skills",
        eventName: "discover_skills_force_refresh_requested",
        action: "discover_skills",
        level: "info",
        message: "Skill registry cache bypass requested.",
        userId: user.id,
        context: {
          forceRefresh,
        },
      });
    }

    const discoveryResult = await getWorkspaceSkillService().discoverWorkspaceSkills({
      userId: user.id,
      forceRefresh,
    });
    return Response.json(discoveryResult);
  } catch (error) {
    await logServerRouteEvent({
      request,
      route: "/api/skills",
      eventName: "discover_skills_failed",
      action: "discover_skills",
      statusCode: 500,
      error,
      userId: user.id,
    });

    return errorResponse({
      status: 500,
      code: "discover_skills_failed",
      error: `Failed to discover skills: ${readErrorMessage(error)}`,
    });
  }
}
