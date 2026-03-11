import { readSkillRegistryRefreshQueryFlag } from "~/lib/server/infrastructure/skills/workspace-skill-request";
import {
  errorResponse,
  readErrorMessage,
} from "~/lib/server/infrastructure/http/route-transport";
import { logServerRouteEvent } from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import type { WorkspaceSkillService } from "~/lib/server/usecase/skills/workspace-skill-service";

const SKILLS_COLLECTION_ROUTE_PATH = "/api/skills";

export async function handleSkillsCollectionLoader(options: {
  request: Request;
  userId: number;
  workspaceSkillService: WorkspaceSkillService;
}): Promise<Response> {
  const { request, userId, workspaceSkillService } = options;

  try {
    const forceRefresh = readSkillRegistryRefreshQueryFlag(request.url);
    if (forceRefresh) {
      await logServerRouteEvent({
        request,
        route: SKILLS_COLLECTION_ROUTE_PATH,
        eventName: "discover_skills_force_refresh_requested",
        action: "discover_skills",
        level: "info",
        message: "Skill registry cache bypass requested.",
        userId,
        context: {
          forceRefresh,
        },
      });
    }

    const discoveryResult = await workspaceSkillService.discoverWorkspaceSkills({
      userId,
      forceRefresh,
    });
    return Response.json(discoveryResult);
  } catch (error) {
    await logServerRouteEvent({
      request,
      route: SKILLS_COLLECTION_ROUTE_PATH,
      eventName: "discover_skills_failed",
      action: "discover_skills",
      statusCode: 500,
      error,
      userId,
    });

    return errorResponse({
      status: 500,
      code: "discover_skills_failed",
      error: `Failed to discover skills: ${readErrorMessage(error)}`,
    });
  }
}
