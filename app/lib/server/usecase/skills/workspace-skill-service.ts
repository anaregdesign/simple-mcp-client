/**
 * Workspace Skill application service module.
 */
import {
  isSkillRegistryId,
  parseSkillRegistrySkillName,
  readSkillRegistrySkillNameValidationMessage,
  type SkillRegistryId,
} from "~/lib/contracts/skills/registry";
import type {
  SkillCatalogEntry,
  SkillRegistryCatalog,
} from "~/lib/contracts/skills/types";
import {
  createWorkspaceSkillProfilePersistenceRepository,
} from "~/lib/server/infrastructure/repositories/workspace-skill-profile-persistence-repository";
import {
  discoverWorkspaceSkillCatalog,
  discoverWorkspaceSkillRegistries,
} from "~/lib/server/infrastructure/gateways/skills/skill-discovery-gateway";
import type { WorkspaceSkillProfilesData } from "~/lib/domain/repositories/workspace-skill-profile-repository";

export type SkillDiscoveryResult = {
  skills: SkillCatalogEntry[];
  registries: SkillRegistryCatalog[];
  skillWarnings: string[];
  registryWarnings: string[];
  warnings: string[];
};

type WorkspaceSkillProfileReconcilePayload = {
  forceRefresh: boolean;
};

const workspaceSkillProfileRepository =
  createWorkspaceSkillProfilePersistenceRepository();

export class WorkspaceSkillService {
  async readWorkspaceSkillProfiles(userId: number): Promise<WorkspaceSkillProfilesData> {
    return readWorkspaceSkillProfiles(userId);
  }

  async discoverWorkspaceSkills(options: {
    userId: number;
    forceRefresh: boolean;
  }): Promise<SkillDiscoveryResult> {
    return discoverWorkspaceSkills(options);
  }

  async syncWorkspaceSkillMasters(options: {
    userId: number;
    skills: SkillCatalogEntry[];
    registries: SkillRegistryCatalog[];
  }): Promise<{
    workspaceSkillProfileCount: number;
    workspaceSkillRegistryProfileCount: number;
  }> {
    return syncWorkspaceSkillMasters(options);
  }
}

export const workspaceSkillService = new WorkspaceSkillService();

export function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error.";
}

export type SkillRegistryMutationPayload = {
  registryId: SkillRegistryId;
  skillName: string;
};

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function readSkillRegistryRefreshQueryFlag(requestUrl: string): boolean {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(requestUrl);
  } catch {
    return false;
  }

  const refreshFlag = parsedUrl.searchParams.get("refresh")?.trim().toLowerCase() ?? "";
  return refreshFlag === "1" || refreshFlag === "true" || refreshFlag === "yes";
}

export async function readWorkspaceSkillProfileReconcilePayload(
  request: Request,
): Promise<ParseResult<WorkspaceSkillProfileReconcilePayload>> {
  const contentType = request.headers.get("content-type")?.trim().toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    const content = (await request.text().catch(() => "")).trim();
    if (!content) {
      return {
        ok: true,
        value: {
          forceRefresh: false,
        },
      };
    }

    return {
      ok: false,
      error: "Request body must be JSON.",
    };
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return {
      ok: false,
      error: "Request body must be valid JSON.",
    };
  }

  return readWorkspaceSkillProfileReconcilePayloadFromUnknown(payload);
}

export function readWorkspaceSkillProfileReconcilePayloadFromUnknown(
  payload: unknown,
): ParseResult<WorkspaceSkillProfileReconcilePayload> {
  if (!isRecord(payload)) {
    return {
      ok: false,
      error: "Request body must be a JSON object.",
    };
  }

  const forceRefreshValue = payload.forceRefresh;
  if (forceRefreshValue === undefined) {
    return {
      ok: true,
      value: {
        forceRefresh: false,
      },
    };
  }
  if (typeof forceRefreshValue !== "boolean") {
    return {
      ok: false,
      error: "`forceRefresh` must be a boolean.",
    };
  }

  return {
    ok: true,
    value: {
      forceRefresh: forceRefreshValue,
    },
  };
}

export function parseSkillRegistryMutationPath(
  registryIdInput: string,
  skillNameInput: string,
): ParseResult<SkillRegistryMutationPayload> {
  const registryId = registryIdInput.trim();
  if (!isSkillRegistryId(registryId)) {
    return {
      ok: false,
      error: "`registryId` is invalid.",
    };
  }

  const skillName = skillNameInput.trim();
  const parsedSkillName = parseSkillRegistrySkillName(registryId, skillName);
  if (!parsedSkillName) {
    return {
      ok: false,
      error: readSkillRegistrySkillNameValidationMessage(registryId),
    };
  }

  return {
    ok: true,
    value: {
      registryId,
      skillName: parsedSkillName.normalizedSkillName,
    },
  };
}

export async function syncWorkspaceSkillMasters(options: {
  userId: number;
  skills: SkillCatalogEntry[];
  registries: SkillRegistryCatalog[];
}): Promise<{
  workspaceSkillProfileCount: number;
  workspaceSkillRegistryProfileCount: number;
}> {
  return workspaceSkillProfileRepository.syncMasters(options);
}

async function readWorkspaceSkillProfiles(
  userId: number,
): Promise<WorkspaceSkillProfilesData> {
  return workspaceSkillProfileRepository.readProfiles(userId);
}

async function discoverWorkspaceSkills(options: {
  userId: number;
  forceRefresh: boolean;
}): Promise<SkillDiscoveryResult> {
  const [catalogDiscovery, registryDiscovery] = await Promise.all([
    discoverWorkspaceSkillCatalog({ workspaceUserId: options.userId }),
    discoverWorkspaceSkillRegistries({
      workspaceUserId: options.userId,
      forceRefresh: options.forceRefresh,
    }),
  ]);

  return {
    skills: catalogDiscovery.skills,
    registries: registryDiscovery.catalogs,
    skillWarnings: catalogDiscovery.warnings,
    registryWarnings: registryDiscovery.warnings,
    warnings: [...catalogDiscovery.warnings, ...registryDiscovery.warnings],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

export const skillsRouteTestUtils = {
  parseSkillRegistryMutationPath,
  readSkillRegistryRefreshQueryFlag,
  readWorkspaceSkillProfileReconcilePayloadFromUnknown,
};
