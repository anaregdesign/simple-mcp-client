import {
  authRequiredResponse,
  errorResponse,
  methodNotAllowedResponse,
  readErrorMessage,
  validationErrorResponse,
} from "~/lib/server/infrastructure/http/route-transport";
import { parseSkillRegistryMutationPath } from "~/lib/server/infrastructure/skills/workspace-skill-request";
import { readAuthenticatedUser } from "~/lib/server/infrastructure/auth/read-authenticated-user";
import { logServerRouteEvent } from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import type {
  WorkspaceSkillRegistryMutationResult,
  WorkspaceSkillRegistryMutationService,
} from "~/lib/server/usecase/skills/workspace-skill-registry-mutation-service";

const SKILL_REGISTRY_SKILL_ALLOWED_METHODS = ["PUT", "DELETE"] as const;
const SKILL_REGISTRY_SKILL_ROUTE_PATH = "/api/skills/registries/:registryId/skills/*";

export function handleWorkspaceSkillRegistryMutationLoader(): Response {
  return methodNotAllowedResponse(SKILL_REGISTRY_SKILL_ALLOWED_METHODS);
}

export async function handleWorkspaceSkillRegistryMutationAction(options: {
  request: Request;
  registryId: string | undefined;
  skillName: string | undefined;
  workspaceSkillRegistryMutationService: WorkspaceSkillRegistryMutationService;
}): Promise<Response> {
  const {
    request,
    registryId,
    skillName,
    workspaceSkillRegistryMutationService,
  } = options;

  if (request.method !== "PUT" && request.method !== "DELETE") {
    return methodNotAllowedResponse(SKILL_REGISTRY_SKILL_ALLOWED_METHODS);
  }

  const user = await readAuthenticatedUser();
  if (!user) {
    return authRequiredResponse();
  }

  const normalizedRegistryId =
    typeof registryId === "string" ? registryId : "";
  const normalizedSkillName = typeof skillName === "string" ? skillName : "";
  const parsedMutation = parseSkillRegistryMutationPath(
    normalizedRegistryId,
    normalizedSkillName,
  );
  if (!parsedMutation.ok) {
    await logServerRouteEvent({
      request,
      route: SKILL_REGISTRY_SKILL_ROUTE_PATH,
      eventName: "invalid_skills_mutation_request",
      action: "validate_payload",
      level: "warning",
      statusCode: 422,
      message: parsedMutation.error,
      userId: user.id,
      context: {
        registryId: normalizedRegistryId,
        skillName: normalizedSkillName,
      },
    });

    return validationErrorResponse(
      "invalid_skills_mutation_request",
      parsedMutation.error,
    );
  }

  try {
    const mutationResult =
      request.method === "PUT"
        ? await workspaceSkillRegistryMutationService.installSkill({
            userId: user.id,
            registryId: parsedMutation.value.registryId,
            skillName: parsedMutation.value.skillName,
          })
        : await workspaceSkillRegistryMutationService.deleteSkill({
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
      route: SKILL_REGISTRY_SKILL_ROUTE_PATH,
      eventName: "skills_action_failed",
      action:
        request.method === "PUT"
          ? "install_registry_skill"
          : "delete_registry_skill",
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
  const encodedSkillPath = skillName
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
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
