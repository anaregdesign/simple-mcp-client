/**
 * Azure selection service module.
 */
import {
  AzureSelectionPreference,
} from "~/lib/domain/entities/azure-selection-preference";
import type {
  AzureSelectionIdentity,
  AzureSelectionPreferenceRepository,
} from "~/lib/domain/repositories/azure-selection-preference-repository";
import { REASONING_EFFORT_OPTIONS } from "~/lib/constants/chat";
import { DEFAULT_THEME_MODE } from "~/lib/constants/client";
import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";
import type { ThemeMode } from "~/lib/domain/value-objects/theme-mode";
import { readThemeModeFromUnknown } from "~/lib/domain/value-objects/theme-mode";

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
  const base =
    existing ??
    new AzureSelectionPreference({
      tenantId: identity.tenantId,
      principalId: identity.principalId,
      theme: preference.theme ?? DEFAULT_THEME_MODE,
      playground: null,
      utility: null,
    });

  return base.withChanges({
    theme: preference.theme ?? existing?.theme ?? DEFAULT_THEME_MODE,
    playground:
      preference.target === "playground"
        ? AzureSelectionPreference.createTargetPreference(
            preference.projectId,
            preference.deploymentName,
          )
        : undefined,
    utility:
      preference.target === "utility"
        ? AzureSelectionPreference.createUtilityTargetPreference(
            preference.projectId,
            preference.deploymentName,
            preference.reasoningEffort,
          )
        : undefined,
  });
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
