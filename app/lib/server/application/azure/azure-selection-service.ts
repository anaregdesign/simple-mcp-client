/**
 * Azure selection service module.
 */
import {
  ensurePersistenceDatabaseReady,
  prisma,
} from "~/lib/server/persistence/prisma";
import { readAzureArmUserContext } from "~/lib/server/auth/azure-user";
import { HOME_REASONING_EFFORT_OPTIONS } from "~/lib/constants/chat";
import { HOME_DEFAULT_THEME } from "~/lib/constants/client";
import type { ThemeMode, ReasoningEffort } from "~/lib/client/shared/view-types";
import { readThemeModeFromUnknown } from "~/lib/client/settings/theme-mode";

type AzureSelectionPreferencePayload = {
  target: AzureSelectionTarget | null;
  projectId: string;
  deploymentName: string;
  reasoningEffort: ReasoningEffort | null;
  theme: ThemeMode | null;
};

type AzureSelectionTarget = "playground" | "utility";

type AzureSelectionTargetPreference = {
  projectId: string;
  deploymentName: string;
};

type AzureUtilitySelectionTargetPreference = AzureSelectionTargetPreference & {
  reasoningEffort: ReasoningEffort;
};

export type AzureSelectionPreference = {
  tenantId: string;
  principalId: string;
  theme: ThemeMode;
  playground: AzureSelectionTargetPreference | null;
  utility: AzureUtilitySelectionTargetPreference | null;
};

export class AzureSelectionService {
  async readStoredSelection(identity: {
    tenantId: string;
    principalId: string;
  }): Promise<AzureSelectionPreference | null> {
    return readStoredSelection(identity);
  }

  async saveStoredSelection(
    identity: {
      tenantId: string;
      principalId: string;
    },
    preference: AzureSelectionPreferencePayload,
  ): Promise<{ selection: AzureSelectionPreference; created: boolean }> {
    return saveStoredSelection(identity, preference);
  }

  async deleteStoredSelection(identity: {
    tenantId: string;
    principalId: string;
  }): Promise<boolean> {
    return deleteStoredSelection(identity);
  }
}

export const azureSelectionService = new AzureSelectionService();

export function parseAzureSelectionPreference(value: unknown): AzureSelectionPreferencePayload | null {
  if (!isRecord(value)) {
    return null;
  }

  const target = value.target;
  const projectId = typeof value.projectId === "string" ? value.projectId.trim() : "";
  const deploymentName = typeof value.deploymentName === "string" ? value.deploymentName.trim() : "";
  const reasoningEffort =
    typeof value.reasoningEffort === "string"
      ? readReasoningEffortFromUnknown(value.reasoningEffort)
      : null;
  const theme = readThemeModeFromUnknown(value.theme);
  const hasSelectionInput =
    value.target !== undefined ||
    value.projectId !== undefined ||
    value.deploymentName !== undefined ||
    value.reasoningEffort !== undefined;

  if (!hasSelectionInput) {
    if (!theme) {
      return null;
    }
    return {
      target: null,
      projectId: "",
      deploymentName: "",
      reasoningEffort: null,
      theme,
    };
  }

  if (
    (target !== "playground" && target !== "utility") ||
    !projectId ||
    !deploymentName ||
    (target === "utility" && !reasoningEffort)
  ) {
    return null;
  }

  return {
    target,
    projectId,
    deploymentName,
    reasoningEffort,
    theme,
  };
}

async function readStoredSelection(
  identity: {
    tenantId: string;
    principalId: string;
  },
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

async function saveStoredSelection(
  identity: {
    tenantId: string;
    principalId: string;
  },
  preference: AzureSelectionPreferencePayload,
): Promise<{ selection: AzureSelectionPreference; created: boolean }> {
  await ensurePersistenceDatabaseReady();
  const user = await prisma.workspaceUser.upsert({
    where: {
      tenantId_principalId: {
        tenantId: identity.tenantId,
        principalId: identity.principalId,
      },
    },
    create: {
      tenantId: identity.tenantId,
      principalId: identity.principalId,
    },
    update: {},
  });

  const existing = await prisma.azureSelectionPreference.findUnique({
    where: { userId: user.id },
    select: { userId: true },
  });

  const saved = await prisma.azureSelectionPreference.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      projectId: preference.target === "playground" ? preference.projectId : "",
      deploymentName: preference.target === "playground" ? preference.deploymentName : "",
      theme: preference.theme ?? HOME_DEFAULT_THEME,
      utilityProjectId: preference.target === "utility" ? preference.projectId : "",
      utilityDeploymentName: preference.target === "utility" ? preference.deploymentName : "",
      utilityReasoningEffort:
        preference.target === "utility" ? preference.reasoningEffort ?? "high" : "high",
    },
    update: {
      ...(preference.target === "playground"
        ? {
            projectId: preference.projectId,
            deploymentName: preference.deploymentName,
          }
        : {}),
      ...(preference.target === "utility"
        ? {
            utilityProjectId: preference.projectId,
            utilityDeploymentName: preference.deploymentName,
            utilityReasoningEffort: preference.reasoningEffort ?? "high",
          }
        : {}),
      ...(preference.theme
        ? {
            theme: preference.theme,
          }
        : {}),
    },
  });

  return {
    selection: mapSelectionRecord(user, saved),
    created: !existing,
  };
}

async function deleteStoredSelection(identity: {
  tenantId: string;
  principalId: string;
}): Promise<boolean> {
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

export async function readAuthenticatedIdentity(): Promise<{
  tenantId: string;
  principalId: string;
} | null> {
  const context = await readAzureArmUserContext();
  if (!context) {
    return null;
  }

  return {
    tenantId: context.tenantId,
    principalId: context.principalId,
  };
}

function mapSelectionRecord(
  user: {
    tenantId: string;
    principalId: string;
  },
  selection: {
    projectId: string;
    deploymentName: string;
    theme: string;
    utilityProjectId: string;
    utilityDeploymentName: string;
    utilityReasoningEffort: string;
  },
): AzureSelectionPreference {
  return {
    tenantId: user.tenantId,
    principalId: user.principalId,
    theme: readThemeModeFromUnknown(selection.theme) ?? HOME_DEFAULT_THEME,
    playground: mapSelectionTarget(selection.projectId, selection.deploymentName),
    utility: mapUtilitySelectionTarget(
      selection.utilityProjectId,
      selection.utilityDeploymentName,
      selection.utilityReasoningEffort,
    ),
  };
}

function mapSelectionTarget(
  projectId: string,
  deploymentName: string,
): AzureSelectionTargetPreference | null {
  const normalizedProjectId = projectId.trim();
  const normalizedDeploymentName = deploymentName.trim();
  if (!normalizedProjectId || !normalizedDeploymentName) {
    return null;
  }

  return {
    projectId: normalizedProjectId,
    deploymentName: normalizedDeploymentName,
  };
}

function mapUtilitySelectionTarget(
  projectId: string,
  deploymentName: string,
  reasoningEffort: string,
): AzureUtilitySelectionTargetPreference | null {
  const base = mapSelectionTarget(projectId, deploymentName);
  if (!base) {
    return null;
  }

  const normalizedReasoningEffort = readReasoningEffortFromUnknown(reasoningEffort) ?? "high";
  return {
    ...base,
    reasoningEffort: normalizedReasoningEffort,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error.";
}

function readReasoningEffortFromUnknown(value: unknown): ReasoningEffort | null {
  if (typeof value !== "string") {
    return null;
  }
  if (HOME_REASONING_EFFORT_OPTIONS.includes(value as ReasoningEffort)) {
    return value as ReasoningEffort;
  }

  return null;
}
