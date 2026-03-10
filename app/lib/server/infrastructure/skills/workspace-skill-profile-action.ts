import {
  readWorkspaceSkillProfileReconcilePayload,
} from "~/lib/server/infrastructure/skills/workspace-skill-request";
import {
  presentReconcileWorkspaceSkillProfilesData,
  presentWorkspaceSkillProfilesData,
} from "~/lib/server/infrastructure/skills/workspace-skill-profile-presentation";
import {
  readErrorMessage,
  structuredErrorResponse,
} from "~/lib/server/infrastructure/http/route-transport";
import { logServerRouteEvent } from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import type { WorkspaceSkillService } from "~/lib/server/usecase/skills/workspace-skill-service";

const WORKSPACE_SKILL_PROFILES_ROUTE_PATH = "/api/workspace-skill-profiles";

export async function handleWorkspaceSkillProfilesLoader(options: {
  request: Request;
  userId: number;
  workspaceSkillService: WorkspaceSkillService;
}): Promise<Response> {
  const { request, userId, workspaceSkillService } = options;

  try {
    const data = await workspaceSkillService.readWorkspaceSkillProfiles(userId);
    return Response.json(presentWorkspaceSkillProfilesData(data));
  } catch (error) {
    await logServerRouteEvent({
      request,
      route: WORKSPACE_SKILL_PROFILES_ROUTE_PATH,
      eventName: "load_workspace_skill_profiles_failed",
      action: "load_workspace_skill_profiles",
      statusCode: 500,
      error,
      userId,
    });

    return structuredErrorResponse({
      status: 500,
      code: "load_workspace_skill_profiles_failed",
      message: `Failed to load Workspace Skill profiles: ${readErrorMessage(error)}`,
    });
  }
}

export async function handleWorkspaceSkillProfilesAction(options: {
  request: Request;
  userId: number;
  workspaceSkillService: WorkspaceSkillService;
}): Promise<Response> {
  const { request, userId, workspaceSkillService } = options;
  const payloadResult = await readWorkspaceSkillProfileReconcilePayload(request);
  if (!payloadResult.ok) {
    await logServerRouteEvent({
      request,
      route: WORKSPACE_SKILL_PROFILES_ROUTE_PATH,
      eventName: "invalid_reconcile_workspace_skill_profiles_request",
      action: "validate_payload",
      level: "warning",
      statusCode: 422,
      message: payloadResult.error,
      userId,
    });

    return structuredErrorResponse({
      status: 422,
      code: "invalid_reconcile_workspace_skill_profiles_request",
      message: payloadResult.error,
    });
  }

  try {
    const discoveryResult = await workspaceSkillService.discoverWorkspaceSkills({
      userId,
      forceRefresh: payloadResult.value.forceRefresh,
    });
    const syncResult = await workspaceSkillService.syncWorkspaceSkillMasters({
      userId,
      skills: discoveryResult.skills,
      registries: discoveryResult.registries,
    });
    const profilesData = await workspaceSkillService.readWorkspaceSkillProfiles(
      userId,
    );

    return Response.json(
      presentReconcileWorkspaceSkillProfilesData({
        discovery: discoveryResult,
        sync: syncResult,
        profilesData,
      }),
    );
  } catch (error) {
    await logServerRouteEvent({
      request,
      route: WORKSPACE_SKILL_PROFILES_ROUTE_PATH,
      eventName: "reconcile_workspace_skill_profiles_failed",
      action: "reconcile_workspace_skill_profiles",
      statusCode: 500,
      error,
      userId,
    });

    return structuredErrorResponse({
      status: 500,
      code: "reconcile_workspace_skill_profiles_failed",
      message: `Failed to reconcile Workspace Skill profiles: ${readErrorMessage(error)}`,
    });
  }
}
