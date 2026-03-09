/**
 * Azure selection service module.
 */
import {
  AzureSelectionPreference,
  type AzureSelectionTargetPreference,
  type AzureUtilitySelectionTargetPreference,
} from "~/lib/domain/azure/azure-selection-preference";
import type {
  AzureSelectionIdentity,
  AzureSelectionPreferenceRepository,
} from "~/lib/domain/repositories/azure-selection-preference-repository";
import { REASONING_EFFORT_OPTIONS } from "~/lib/constants/chat";
import { DEFAULT_THEME_MODE } from "~/lib/constants/client";
import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";
import type { ThemeMode } from "~/lib/domain/value-objects/theme-mode";
import { readThemeModeFromUnknown } from "~/lib/contracts/shared/theme-mode";

type AzureSelectionPreferencePayload = {
  target: AzureSelectionTarget | null;
  projectId: string;
  deploymentName: string;
  reasoningEffort: ReasoningEffort | null;
  theme: ThemeMode | null;
};

type AzureSelectionTarget = "playground" | "utility";

export class AzureSelectionService {
  constructor(
    private readonly repository: AzureSelectionPreferenceRepository,
  ) {}

  async readStoredSelection(identity: {
    tenantId: string;
    principalId: string;
  }): Promise<AzureSelectionPreference | null> {
    return this.repository.findByIdentity(identity);
  }

  async saveStoredSelection(
    identity: {
      tenantId: string;
      principalId: string;
    },
    preference: AzureSelectionPreferencePayload,
  ): Promise<{ selection: AzureSelectionPreference; created: boolean }> {
    const existing = await this.repository.findByIdentity(identity);
    const selection = buildAzureSelectionPreference(
      identity,
      preference,
      existing,
    );

    return {
      selection: await this.repository.save(selection),
      created: existing === null,
    };
  }

  async deleteStoredSelection(identity: {
    tenantId: string;
    principalId: string;
  }): Promise<boolean> {
    return this.repository.deleteByIdentity(identity);
  }
}

export { AzureSelectionPreference };
export function createAzureSelectionService(
  repository: AzureSelectionPreferenceRepository,
): AzureSelectionService {
  return new AzureSelectionService(repository);
}

export function parseAzureSelectionPreference(
  value: unknown,
): AzureSelectionPreferencePayload | null {
  if (!isRecord(value)) {
    return null;
  }

  const target = value.target;
  const projectId =
    typeof value.projectId === "string" ? value.projectId.trim() : "";
  const deploymentName =
    typeof value.deploymentName === "string" ? value.deploymentName.trim() : "";
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

function buildAzureSelectionPreference(
  identity: AzureSelectionIdentity,
  preference: AzureSelectionPreferencePayload,
  existing: AzureSelectionPreference | null,
): AzureSelectionPreference {
  return new AzureSelectionPreference({
    tenantId: identity.tenantId,
    principalId: identity.principalId,
    theme: preference.theme ?? existing?.theme ?? DEFAULT_THEME_MODE,
    playground:
      preference.target === "playground"
        ? mapSelectionTarget(
            preference.projectId,
            preference.deploymentName,
          )
        : existing?.playground ?? null,
    utility:
      preference.target === "utility"
        ? mapUtilitySelectionTarget(
            preference.projectId,
            preference.deploymentName,
            preference.reasoningEffort,
          )
        : existing?.utility ?? null,
  });
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
  reasoningEffort: ReasoningEffort | null,
): AzureUtilitySelectionTargetPreference | null {
  const base = mapSelectionTarget(projectId, deploymentName);
  if (!base) {
    return null;
  }

  return {
    ...base,
    reasoningEffort: reasoningEffort ?? "high",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function readReasoningEffortFromUnknown(
  value: unknown,
): ReasoningEffort | null {
  if (typeof value !== "string") {
    return null;
  }
  if (REASONING_EFFORT_OPTIONS.includes(value as ReasoningEffort)) {
    return value as ReasoningEffort;
  }

  return null;
}
