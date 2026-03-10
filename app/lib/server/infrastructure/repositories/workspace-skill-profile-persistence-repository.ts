import {
  isSkillRegistryId,
  readSkillRegistryInstallDirectoryNameFromSkillLocation,
  readSkillRegistryOptionById,
} from "~/lib/domain/value-objects/skill-registry";
import type {
  SkillCatalogEntry,
  SkillRegistryCatalog,
} from "~/lib/contracts/skills/types";
import type {
  WorkspaceSkillProfile,
  WorkspaceSkillProfilesData,
  WorkspaceSkillRegistryProfile,
} from "~/lib/domain/repositories/workspace-skill-profile-repository";
import type {
  SyncWorkspaceSkillMastersResult,
  WorkspaceSkillProfileRepository,
} from "~/lib/domain/repositories/workspace-skill-profile-repository";
import {
  ensurePersistenceDatabaseReady,
  prisma,
} from "~/lib/server/infrastructure/persistence/prisma";

export class WorkspaceSkillProfilePersistenceRepository
  implements WorkspaceSkillProfileRepository
{
  async readByUserId(userId: number): Promise<WorkspaceSkillProfilesData> {
    await ensurePersistenceDatabaseReady();

    const [workspaceSkillProfiles, workspaceSkillRegistryProfiles] =
      await Promise.all([
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
      workspaceSkillProfiles: workspaceSkillProfiles.flatMap((profile) => {
        const mapped = mapWorkspaceSkillProfile(profile);
        return mapped ? [mapped] : [];
      }),
      workspaceSkillRegistryProfiles: workspaceSkillRegistryProfiles.flatMap(
        (profile) => {
          const mapped = mapWorkspaceSkillRegistryProfile(profile);
          return mapped ? [mapped] : [];
        },
      ),
    };
  }

  async syncSkillMasters(options: {
    userId: number;
    skills: SkillCatalogEntry[];
    registries: SkillRegistryCatalog[];
  }): Promise<SyncWorkspaceSkillMastersResult> {
    await ensurePersistenceDatabaseReady();

    return prisma.$transaction(async (transaction) => {
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

        const registryProfile =
          await transaction.workspaceSkillRegistryProfile.upsert({
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
              installDirectoryName:
                registryProfileRecord.installDirectoryName,
            },
            select: {
              id: true,
            },
          });

        registryProfileIdByInstallDirectory.set(
          installDirectoryName,
          registryProfile.id,
        );
      }

      for (const skill of options.skills) {
        const installDirectoryName =
          readSkillRegistryInstallDirectoryNameFromSkillLocation(skill.location);
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

      const [
        workspaceSkillProfileCount,
        workspaceSkillRegistryProfileCount,
      ] = await Promise.all([
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
}

export function createWorkspaceSkillProfilePersistenceRepository(): WorkspaceSkillProfileRepository {
  return new WorkspaceSkillProfilePersistenceRepository();
}

function mapWorkspaceSkillProfile(
  profile: {
    id: number;
    userId: number;
    registryProfileId: number | null;
    name: string;
    location: string;
    source: string;
  },
): WorkspaceSkillProfile | null {
  if (
    profile.source !== "workspace" &&
    profile.source !== "codex_home" &&
    profile.source !== "app_data"
  ) {
    return null;
  }

  return {
    ...profile,
    source: profile.source,
  };
}

function mapWorkspaceSkillRegistryProfile(
  profile: {
    id: number;
    userId: number;
    registryId: string;
    registryLabel: string;
    registryDescription: string;
    repository: string;
    repositoryUrl: string;
    sourcePath: string;
    installDirectoryName: string;
  },
): WorkspaceSkillRegistryProfile | null {
  if (!isSkillRegistryId(profile.registryId)) {
    return null;
  }

  return {
    ...profile,
    registryId: profile.registryId,
  };
}

function buildWorkspaceSkillRegistryProfileRecord(
  userId: number,
  registry: SkillRegistryCatalog,
  registryOption: NonNullable<ReturnType<typeof readSkillRegistryOptionById>>,
): Omit<WorkspaceSkillRegistryProfile, "id"> {
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
