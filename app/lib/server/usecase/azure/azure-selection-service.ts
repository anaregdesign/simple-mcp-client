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
import { DEFAULT_THEME_MODE } from "~/lib/constants/client";
import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";
import type { ThemeMode } from "~/lib/domain/value-objects/theme-mode";

export type AzureSelectionPreferenceWriteInput = {
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

  async readStoredSelection(
    identity: AzureSelectionIdentity,
  ): Promise<AzureSelectionPreference | null> {
    return this.repository.findByIdentity(identity);
  }

  async saveStoredSelection(
    identity: AzureSelectionIdentity,
    preference: AzureSelectionPreferenceWriteInput,
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

  async deleteStoredSelection(identity: AzureSelectionIdentity): Promise<boolean> {
    return this.repository.deleteByIdentity(identity);
  }
}

export function createAzureSelectionService(
  repository: AzureSelectionPreferenceRepository,
): AzureSelectionService {
  return new AzureSelectionService(repository);
}

function buildAzureSelectionPreference(
  identity: AzureSelectionIdentity,
  preference: AzureSelectionPreferenceWriteInput,
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
