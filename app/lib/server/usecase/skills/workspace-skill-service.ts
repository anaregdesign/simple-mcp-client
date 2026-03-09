/**
 * Workspace Skill application service module.
 */
import {
  isSkillRegistryId,
  parseSkillRegistrySkillName,
  readSkillRegistrySkillNameValidationMessage,
  readSkillRegistryOptionById,
  SKILL_REGISTRY_OPTIONS,
  type SkillRegistryId,
} from "~/lib/contracts/skills/registry";
import type {
  SkillCatalogEntry,
  SkillRegistryCatalog,
} from "~/lib/contracts/skills/types";
import type {
  WorkspaceSkillProfileResource,
  WorkspaceSkillRegistryProfileResource,
} from "~/lib/contracts/skills/workspace-skill-profiles";
import { readAzureArmUserContext } from "~/lib/server/auth/azure-user";
import {
  ensurePersistenceDatabaseReady,
  prisma,
} from "~/lib/server/infrastructure/persistence/prisma";
import { getOrCreateUserByIdentity } from "~/lib/server/infrastructure/persistence/user";
import { discoverSkillCatalog } from "~/lib/server/skills/catalog";
import { discoverSkillRegistries } from "~/lib/server/skills/registry";

export type SkillDiscoveryResult = {
  skills: SkillCatalogEntry[];
  registries: SkillRegistryCatalog[];
  skillWarnings: string[];
  registryWarnings: string[];
  warnings: string[];
};

type WorkspaceSkillProfilesData = {
  workspaceSkillProfiles: WorkspaceSkillProfileResource[];
  workspaceSkillRegistryProfiles: WorkspaceSkillRegistryProfileResource[];
};

type WorkspaceSkillProfileReconcilePayload = {
  forceRefresh: boolean;
};

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

export async function readAuthenticatedUser(): Promise<{ id: number } | null> {
  const userContext = await readAzureArmUserContext();
  if (!userContext) {
    return null;
  }

  const user = await getOrCreateUserByIdentity({
    tenantId: userContext.tenantId,
    principalId: userContext.principalId,
  });

  return {
    id: user.id,
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
  await ensurePersistenceDatabaseReady();

  return await prisma.$transaction(async (transaction) => {
    const registryProfileIdByInstallDirectory = new Map<string, number>();

    for (const registry of options.registries) {
      const registryOption = readSkillRegistryOptionById(registry.registryId);
      if (!registryOption) {
        continue;
      }
      const installDirectoryName = registryOption.installDirectoryName;
      if (!installDirectoryName) {
        continue;
      }

      const registryProfileRecord = buildWorkspaceSkillRegistryProfileRecord(
        options.userId,
        registry,
        registryOption,
      );

      const registryProfile = await transaction.workspaceSkillRegistryProfile.upsert({
        where: {
          userId_registryId: {
            userId: options.userId,
            registryId: registry.registryId,
          },
        },
        create: registryProfileRecord,
        update: {
          registryLabel: registryProfileRecord.registryLabel,
          registryDescription: registryProfileRecord.registryDescription,
          repository: registryProfileRecord.repository,
          repositoryUrl: registryProfileRecord.repositoryUrl,
          sourcePath: registryProfileRecord.sourcePath,
          installDirectoryName: registryProfileRecord.installDirectoryName,
        },
        select: {
          id: true,
        },
      });

      registryProfileIdByInstallDirectory.set(installDirectoryName, registryProfile.id);
    }

    for (const skill of options.skills) {
      const installDirectoryName = readRegistryInstallDirectoryNameFromSkillLocation(skill.location);
      const registryProfileId = installDirectoryName
        ? registryProfileIdByInstallDirectory.get(installDirectoryName) ?? null
        : null;

      await transaction.workspaceSkillProfile.upsert({
        where: {
          userId_location: {
            userId: options.userId,
            location: skill.location,
          },
        },
        create: {
          userId: options.userId,
          registryProfileId,
          name: skill.name,
          location: skill.location,
          source: skill.source,
        },
        update: {
          registryProfileId,
          name: skill.name,
          source: skill.source,
        },
      });
    }

    const [workspaceSkillProfileCount, workspaceSkillRegistryProfileCount] = await Promise.all([
      transaction.workspaceSkillProfile.count({
        where: {
          userId: options.userId,
        },
      }),
      transaction.workspaceSkillRegistryProfile.count({
        where: {
          userId: options.userId,
        },
      }),
    ]);

    return {
      workspaceSkillProfileCount,
      workspaceSkillRegistryProfileCount,
    };
  });
}

async function readWorkspaceSkillProfiles(
  userId: number,
): Promise<WorkspaceSkillProfilesData> {
  await ensurePersistenceDatabaseReady();

  const [workspaceSkillProfiles, workspaceSkillRegistryProfiles] = await Promise.all([
    prisma.workspaceSkillProfile.findMany({
      where: {
        userId,
      },
      orderBy: [
        {
          name: "asc",
        },
        {
          location: "asc",
        },
      ],
      select: {
        id: true,
        userId: true,
        registryProfileId: true,
        name: true,
        location: true,
        source: true,
      },
    }),
    prisma.workspaceSkillRegistryProfile.findMany({
      where: {
        userId,
      },
      orderBy: [
        {
          registryLabel: "asc",
        },
        {
          registryId: "asc",
        },
      ],
      select: {
        id: true,
        userId: true,
        registryId: true,
        registryLabel: true,
        registryDescription: true,
        repository: true,
        repositoryUrl: true,
        sourcePath: true,
        installDirectoryName: true,
      },
    }),
  ]);

  return {
    workspaceSkillProfiles,
    workspaceSkillRegistryProfiles,
  };
}

async function discoverWorkspaceSkills(options: {
  userId: number;
  forceRefresh: boolean;
}): Promise<SkillDiscoveryResult> {
  const [catalogDiscovery, registryDiscovery] = await Promise.all([
    discoverSkillCatalog({ workspaceUserId: options.userId }),
    discoverSkillRegistries({
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

function readRegistryInstallDirectoryNameFromSkillLocation(location: string): string | null {
  const segments = location
    .trim()
    .replaceAll("\\", "/")
    .split("/")
    .filter((segment) => segment.length > 0);
  if (segments.length === 0) {
    return null;
  }

  for (let index = 0; index < segments.length - 1; index += 1) {
    if (segments[index] !== "skills") {
      continue;
    }

    const firstCandidate = segments[index + 1] ?? "";
    const secondCandidate = segments[index + 2] ?? "";
    const candidates = [firstCandidate];
    if (isPositiveIntegerString(firstCandidate)) {
      candidates.push(secondCandidate);
    }

    for (const candidate of candidates) {
      if (
        SKILL_REGISTRY_OPTIONS.some(
          (option) => option.installDirectoryName === candidate,
        )
      ) {
        return candidate;
      }
    }
  }

  return null;
}

function isPositiveIntegerString(value: string): boolean {
  return /^[1-9]\d*$/.test(value.trim());
}

function buildWorkspaceSkillRegistryProfileRecord(
  userId: number,
  registry: SkillRegistryCatalog,
  registryOption: NonNullable<ReturnType<typeof readSkillRegistryOptionById>>,
): Omit<WorkspaceSkillRegistryProfileResource, "id"> {
  return {
    userId,
    registryId: registry.registryId,
    registryLabel: registry.registryLabel,
    registryDescription: registry.registryDescription,
    repository: registry.repository,
    repositoryUrl: registry.repositoryUrl,
    sourcePath: registry.sourcePath,
    installDirectoryName: registryOption.installDirectoryName,
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
