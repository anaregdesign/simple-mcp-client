/**
 * API route module for /api/skills.
 */
import {
  readAuthenticatedUser,
  readErrorMessage,
  readSkillRegistryRefreshQueryFlag,
  skillsRouteTestUtils,
  workspaceSkillService,
} from "~/lib/server/application/skills/workspace-skill-service";
import {
  authRequiredResponse,
  errorResponse,
  methodNotAllowedResponse,
  validationErrorResponse,
} from "~/lib/server/http";
import {
  installGlobalServerErrorLogging,
  logServerRouteEvent,
} from "~/lib/server/observability/runtime-event-log";
import type { Route } from "./+types/api.skills";

export { skillsRouteTestUtils };

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

    const discoveryResult = await workspaceSkillService.discoverWorkspaceSkills({
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
