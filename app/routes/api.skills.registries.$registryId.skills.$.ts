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
} from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import {
  createWorkspaceSkillRegistryMutationGateway,
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
import {
  createWorkspaceSkillRegistryMutationService,
  type WorkspaceSkillRegistryMutationResult,
} from "~/lib/server/usecase/skills/workspace-skill-registry-mutation-service";
import type { Route } from "./+types/api.skills.registries.$registryId.skills.$";

const SKILL_REGISTRY_SKILL_ALLOWED_METHODS = ["PUT", "DELETE"] as const;

function getWorkspaceSkillService() {
  return createWorkspaceSkillService({
    repository: createWorkspaceSkillProfilePersistenceRepository(),
    discoveryGateway: createWorkspaceSkillDiscoveryGateway(),
  });
}

function getWorkspaceSkillRegistryMutationService() {
  return createWorkspaceSkillRegistryMutationService({
    registryGateway: createWorkspaceSkillRegistryMutationGateway(),
    workspaceSkillService: getWorkspaceSkillService(),
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
    const mutationResult = request.method === "PUT"
      ? await getWorkspaceSkillRegistryMutationService().installSkill({
          userId: user.id,
          registryId: parsedMutation.value.registryId,
          skillName: parsedMutation.value.skillName,
        })
      : await getWorkspaceSkillRegistryMutationService().deleteSkill({
          userId: user.id,
          registryId: parsedMutation.value.registryId,
          skillName: parsedMutation.value.skillName,
        });
    const responsePayload = readSkillRegistryMutationResponse(mutationResult);

    return Response.json(
      {
        message: responsePayload.message,
        skills: mutationResult.discoveryResult.skills,
        registries: mutationResult.discoveryResult.registries,
        skillWarnings: mutationResult.discoveryResult.skillWarnings,
        registryWarnings: mutationResult.discoveryResult.registryWarnings,
        warnings: mutationResult.discoveryResult.warnings,
      },
      {
        status: responsePayload.status,
        headers:
          request.method === "PUT" && responsePayload.status === 201
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

function readSkillRegistryMutationResponse(
  result: WorkspaceSkillRegistryMutationResult,
): {
  status: number;
  message: string;
} {
  switch (result.operation) {
    case "installed":
      return {
        status: 201,
        message: `Installed Skill "${result.skillName}".`,
      };
    case "updated":
      return {
        status: 200,
        message: `Updated Skill "${result.skillName}".`,
      };
    case "unchanged":
      return {
        status: 200,
        message: `Skill "${result.skillName}" is already up-to-date.`,
      };
    case "removed":
      return {
        status: 200,
        message: `Removed Skill "${result.skillName}".`,
      };
    case "missing":
      return {
        status: 200,
        message: `Skill "${result.skillName}" was not installed.`,
      };
  }
}
