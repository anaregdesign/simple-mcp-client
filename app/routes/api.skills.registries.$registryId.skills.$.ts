/**
 * API route module for /api/skills/registries/:registryId/skills/*.
 */
import {
  authRequiredResponse,
  errorResponse,
  methodNotAllowedResponse,
  readErrorMessage,
  validationErrorResponse,
} from "~/lib/server/http";
import {
  installGlobalServerErrorLogging,
  logServerRouteEvent,
} from "~/lib/server/observability/runtime-event-log";
import {
  deleteInstalledSkillFromRegistry,
  installSkillFromRegistry,
} from "~/lib/server/infrastructure/gateways/skills/skill-registry-gateway";
import {
  createWorkspaceSkillDiscoveryGateway,
} from "~/lib/server/infrastructure/gateways/skills/skill-discovery-gateway";
import {
  createWorkspaceSkillService,
  parseSkillRegistryMutationPath,
} from "~/lib/server/usecase/skills/workspace-skill-service";
import { readAuthenticatedUser } from "~/lib/server/infrastructure/auth/read-authenticated-user";
import {
  createWorkspaceSkillProfilePersistenceRepository,
} from "~/lib/server/infrastructure/repositories/workspace-skill-profile-persistence-repository";
import type { Route } from "./+types/api.skills.registries.$registryId.skills.$";

const SKILL_REGISTRY_SKILL_ALLOWED_METHODS = ["PUT", "DELETE"] as const;

function getWorkspaceSkillService() {
  return createWorkspaceSkillService({
    repository: createWorkspaceSkillProfilePersistenceRepository(),
    discoveryGateway: createWorkspaceSkillDiscoveryGateway(),
  });
}

export function loader() {
  installGlobalServerErrorLogging();
  return methodNotAllowedResponse(SKILL_REGISTRY_SKILL_ALLOWED_METHODS);
}

export async function action({ request, params }: Route.ActionArgs) {
  installGlobalServerErrorLogging();

  if (request.method !== "PUT" && request.method !== "DELETE") {
    return methodNotAllowedResponse(SKILL_REGISTRY_SKILL_ALLOWED_METHODS);
  }

  const user = await readAuthenticatedUser();
  if (!user) {
    return authRequiredResponse();
  }

  const registryId = typeof params.registryId === "string" ? params.registryId : "";
  const skillName = typeof params["*"] === "string" ? params["*"] : "";
  const parsedMutation = parseSkillRegistryMutationPath(registryId, skillName);
  if (!parsedMutation.ok) {
    await logServerRouteEvent({
      request,
      route: "/api/skills/registries/:registryId/skills/*",
      eventName: "invalid_skills_mutation_request",
      action: "validate_payload",
      level: "warning",
      statusCode: 422,
      message: parsedMutation.error,
      userId: user.id,
      context: {
        registryId,
        skillName,
      },
    });

    return validationErrorResponse("invalid_skills_mutation_request", parsedMutation.error);
  }

  try {
    let message = "";
    let status = 200;

    if (request.method === "PUT") {
      const installResult = await installSkillFromRegistry({
        registryId: parsedMutation.value.registryId,
        skillName: parsedMutation.value.skillName,
        workspaceUserId: user.id,
      });
      if (installResult.operation === "installed") {
        message = `Installed Skill "${installResult.skillName}".`;
        status = 201;
      } else if (installResult.operation === "updated") {
        message = `Updated Skill "${installResult.skillName}".`;
        status = 200;
      } else {
        message = `Skill "${installResult.skillName}" is already up-to-date.`;
        status = 200;
      }
    } else {
      const deleteResult = await deleteInstalledSkillFromRegistry({
        registryId: parsedMutation.value.registryId,
        skillName: parsedMutation.value.skillName,
        workspaceUserId: user.id,
      });
      message = deleteResult.removed
        ? `Removed Skill "${deleteResult.skillName}".`
        : `Skill "${deleteResult.skillName}" was not installed.`;
    }

    const workspaceSkillService = getWorkspaceSkillService();
    const discoveryResult = await workspaceSkillService.discoverWorkspaceSkills({
      userId: user.id,
      forceRefresh: true,
    });
    await workspaceSkillService.syncWorkspaceSkillMasters({
      userId: user.id,
      skills: discoveryResult.skills,
      registries: discoveryResult.registries,
    });

    return Response.json(
      {
        message,
        skills: discoveryResult.skills,
        registries: discoveryResult.registries,
        skillWarnings: discoveryResult.skillWarnings,
        registryWarnings: discoveryResult.registryWarnings,
        warnings: discoveryResult.warnings,
      },
      {
        status,
        headers:
          request.method === "PUT" && status === 201
            ? {
                Location: buildSkillResourcePath(
                  parsedMutation.value.registryId,
                  parsedMutation.value.skillName,
                ),
              }
            : undefined,
      },
    );
  } catch (error) {
    await logServerRouteEvent({
      request,
      route: "/api/skills/registries/:registryId/skills/*",
      eventName: "skills_action_failed",
      action: request.method === "PUT" ? "install_registry_skill" : "delete_registry_skill",
      statusCode: 500,
      error,
      userId: user.id,
      context: {
        registryId: parsedMutation.value.registryId,
        skillName: parsedMutation.value.skillName,
      },
    });

    return errorResponse({
      status: 500,
      code: "skills_action_failed",
      error: `Failed to update Skills: ${readErrorMessage(error)}`,
    });
  }
}

function buildSkillResourcePath(registryId: string, skillName: string): string {
  const encodedSkillPath = skillName.split("/").map((segment) => encodeURIComponent(segment)).join("/");
  return `/api/skills/registries/${encodeURIComponent(registryId)}/skills/${encodedSkillPath}`;
}
