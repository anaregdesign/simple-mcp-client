import {
  structuredAuthRequiredResponse,
  structuredErrorResponse,
  methodNotAllowedResponse,
} from "~/lib/server/http";
import {
  readAuthenticatedUser,
  readErrorMessage,
  readWorkspaceSkillProfileReconcilePayload,
  workspaceSkillService,
} from "~/lib/server/application/skills/workspace-skill-service";
import {
  installGlobalServerErrorLogging,
  logServerRouteEvent,
} from "~/lib/server/observability/runtime-event-log";
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

  try {
    const data = await workspaceSkillService.readWorkspaceSkillProfiles(user.id);
    return Response.json(data);
  } catch (error) {
    await logServerRouteEvent({
      request,
      route: "/api/workspace-skill-profiles",
      eventName: "load_workspace_skill_profiles_failed",
      action: "load_workspace_skill_profiles",
      statusCode: 500,
      error,
      userId: user.id,
    });

    return structuredErrorResponse({
      status: 500,
      code: "load_workspace_skill_profiles_failed",
      message: `Failed to load Workspace Skill profiles: ${readErrorMessage(error)}`,
    });
  }
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

  const payloadResult = await readWorkspaceSkillProfileReconcilePayload(request);
  if (!payloadResult.ok) {
    await logServerRouteEvent({
      request,
      route: "/api/workspace-skill-profiles",
      eventName: "invalid_reconcile_workspace_skill_profiles_request",
      action: "validate_payload",
      level: "warning",
      statusCode: 422,
      message: payloadResult.error,
      userId: user.id,
    });

    return structuredErrorResponse({
      status: 422,
      code: "invalid_reconcile_workspace_skill_profiles_request",
      message: payloadResult.error,
    });
  }

  try {
    const discoveryResult = await workspaceSkillService.discoverWorkspaceSkills({
      userId: user.id,
      forceRefresh: payloadResult.value.forceRefresh,
    });
    const syncResult = await workspaceSkillService.syncWorkspaceSkillMasters({
      userId: user.id,
      skills: discoveryResult.skills,
      registries: discoveryResult.registries,
    });

    const data = await workspaceSkillService.readWorkspaceSkillProfiles(user.id);
    return Response.json({
      message: "Workspace Skill profiles reconciled from installed Skills.",
      skills: discoveryResult.skills,
      skillRegistries: discoveryResult.registries,
      skillWarnings: discoveryResult.skillWarnings,
      registryWarnings: discoveryResult.registryWarnings,
      warnings: discoveryResult.warnings,
      workspaceSkillProfileCount: syncResult.workspaceSkillProfileCount,
      workspaceSkillRegistryProfileCount: syncResult.workspaceSkillRegistryProfileCount,
      workspaceSkillProfiles: data.workspaceSkillProfiles,
      workspaceSkillRegistryProfiles: data.workspaceSkillRegistryProfiles,
    });
  } catch (error) {
    await logServerRouteEvent({
      request,
      route: "/api/workspace-skill-profiles",
      eventName: "reconcile_workspace_skill_profiles_failed",
      action: "reconcile_workspace_skill_profiles",
      statusCode: 500,
      error,
      userId: user.id,
    });

    return structuredErrorResponse({
      status: 500,
      code: "reconcile_workspace_skill_profiles_failed",
      message: `Failed to reconcile Workspace Skill profiles: ${readErrorMessage(error)}`,
    });
  }
}
