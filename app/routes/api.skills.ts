/**
 * API route module for /api/skills.
 */
import {
  readAuthenticatedUser,
  readErrorMessage,
  readSkillRegistryRefreshQueryFlag,
  readWorkspaceSkillProfileReconcilePayload,
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

const SKILLS_COLLECTION_ALLOWED_METHODS = ["GET", "POST"] as const;

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

export async function action({ request }: Route.ActionArgs) {
  installGlobalServerErrorLogging();

  if (request.method !== "POST") {
    return methodNotAllowedResponse(SKILLS_COLLECTION_ALLOWED_METHODS);
  }

  const user = await readAuthenticatedUser();
  if (!user) {
    return authRequiredResponse();
  }

  try {
    const payloadResult = await readWorkspaceSkillProfileReconcilePayload(request);
    if (!payloadResult.ok) {
      await logServerRouteEvent({
        request,
        route: "/api/skills",
        eventName: "invalid_reconcile_workspace_skill_profiles_request",
        action: "validate_payload",
        level: "warning",
        statusCode: 422,
        message: payloadResult.error,
        userId: user.id,
      });

      return validationErrorResponse(
        "invalid_reconcile_workspace_skill_profiles_request",
        payloadResult.error,
      );
    }

    const forceRefresh = payloadResult.value.forceRefresh;
    if (forceRefresh) {
      await logServerRouteEvent({
        request,
        route: "/api/skills",
        eventName: "reconcile_workspace_skill_profiles_force_refresh_requested",
        action: "reconcile_workspace_skill_profiles",
        level: "info",
        message: "Workspace Skill profile reconcile requested with cache bypass.",
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
    const syncResult = await workspaceSkillService.syncWorkspaceSkillMasters({
      userId: user.id,
      skills: discoveryResult.skills,
      registries: discoveryResult.registries,
    });

    await logServerRouteEvent({
      request,
      route: "/api/skills",
      eventName: "reconcile_workspace_skill_profiles_completed",
      action: "reconcile_workspace_skill_profiles",
      level: "info",
      message: "Workspace Skill profiles reconciled from installed Skills.",
      userId: user.id,
      context: {
        forceRefresh,
        discoveredSkillCount: discoveryResult.skills.length,
        discoveredRegistryCount: discoveryResult.registries.length,
        warningCount: discoveryResult.warnings.length,
        workspaceSkillProfileCount: syncResult.workspaceSkillProfileCount,
        workspaceSkillRegistryProfileCount: syncResult.workspaceSkillRegistryProfileCount,
      },
    });

    return Response.json({
      ...discoveryResult,
      message: "Workspace Skill profiles reconciled from installed Skills.",
    });
  } catch (error) {
    await logServerRouteEvent({
      request,
      route: "/api/skills",
      eventName: "reconcile_workspace_skill_profiles_failed",
      action: "reconcile_workspace_skill_profiles",
      statusCode: 500,
      error,
      userId: user.id,
    });

    return errorResponse({
      status: 500,
      code: "reconcile_workspace_skill_profiles_failed",
      error: `Failed to reconcile Workspace Skill profiles: ${readErrorMessage(error)}`,
    });
  }
}
