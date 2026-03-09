import { DEFAULT_THEME_MODE } from "~/lib/constants/client";
import {
  AzureSelectionPreference,
} from "~/lib/domain/entities/azure-selection-preference";
import type {
  AzureSelectionIdentity,
  AzureSelectionPreferenceRepository,
} from "~/lib/domain/repositories/azure-selection-preference-repository";
import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";
import { readThemeModeFromUnknown } from "~/lib/domain/value-objects/theme-mode";
import {
  ensurePersistenceDatabaseReady,
  prisma,
} from "~/lib/server/infrastructure/persistence/prisma";

export class AzureSelectionPreferencePersistenceRepository
  implements AzureSelectionPreferenceRepository
{
  async findByIdentity(
    identity: AzureSelectionIdentity,
  ): Promise<AzureSelectionPreference | null> {
    await ensurePersistenceDatabaseReady();
    const user = await prisma.workspaceUser.findUnique({
      where: {
        tenantId_principalId: {
          tenantId: identity.tenantId,
          principalId: identity.principalId,
        },
      },
      include: {
        azureSelection: true,
      },
    });

    if (!user || !user.azureSelection) {
      return null;
    }

    return mapSelectionRecord(user, user.azureSelection);
  }

  async save(
    preference: AzureSelectionPreference,
  ): Promise<AzureSelectionPreference> {
    await ensurePersistenceDatabaseReady();
    const snapshot = preference.toSnapshot();
    const user = await prisma.workspaceUser.upsert({
      where: {
        tenantId_principalId: {
          tenantId: snapshot.tenantId,
          principalId: snapshot.principalId,
        },
      },
      create: {
        tenantId: snapshot.tenantId,
        principalId: snapshot.principalId,
      },
      update: {},
    });

    const saved = await prisma.azureSelectionPreference.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        projectId: snapshot.playground?.projectId ?? "",
        deploymentName: snapshot.playground?.deploymentName ?? "",
        theme: snapshot.theme,
        utilityProjectId: snapshot.utility?.projectId ?? "",
        utilityDeploymentName: snapshot.utility?.deploymentName ?? "",
        utilityReasoningEffort: snapshot.utility?.reasoningEffort ?? "high",
      },
      update: {
        projectId: snapshot.playground?.projectId ?? "",
        deploymentName: snapshot.playground?.deploymentName ?? "",
        theme: snapshot.theme,
        utilityProjectId: snapshot.utility?.projectId ?? "",
        utilityDeploymentName: snapshot.utility?.deploymentName ?? "",
        utilityReasoningEffort: snapshot.utility?.reasoningEffort ?? "high",
      },
    });

    return mapSelectionRecord(
      {
        tenantId: snapshot.tenantId,
        principalId: snapshot.principalId,
      },
      saved,
    );
  }

  async deleteByIdentity(identity: AzureSelectionIdentity): Promise<boolean> {
    await ensurePersistenceDatabaseReady();
    const user = await prisma.workspaceUser.findUnique({
      where: {
        tenantId_principalId: {
          tenantId: identity.tenantId,
          principalId: identity.principalId,
        },
      },
      select: {
        id: true,
      },
    });
    if (!user) {
      return false;
    }

    const deleteResult = await prisma.azureSelectionPreference.deleteMany({
      where: {
        userId: user.id,
      },
    });
    return deleteResult.count > 0;
  }
}

export function createAzureSelectionPreferencePersistenceRepository(): AzureSelectionPreferenceRepository {
  return new AzureSelectionPreferencePersistenceRepository();
}

function mapSelectionRecord(
  user: AzureSelectionIdentity,
  selection: {
    projectId: string;
    deploymentName: string;
    theme: string;
    utilityProjectId: string;
    utilityDeploymentName: string;
    utilityReasoningEffort: string;
  },
): AzureSelectionPreference {
  return new AzureSelectionPreference({
    tenantId: user.tenantId,
    principalId: user.principalId,
    theme: readThemeModeFromUnknown(selection.theme) ?? DEFAULT_THEME_MODE,
    playground: AzureSelectionPreference.createTargetPreference(
      selection.projectId,
      selection.deploymentName,
    ),
    utility: AzureSelectionPreference.createUtilityTargetPreference(
      selection.utilityProjectId,
      selection.utilityDeploymentName,
      readReasoningEffortFromUnknown(selection.utilityReasoningEffort),
    ),
  });
}

function readReasoningEffortFromUnknown(
  value: unknown,
): ReasoningEffort | null {
  return value === "minimal" ||
    value === "low" ||
    value === "medium" ||
    value === "high"
    ? value
    : null;
}
