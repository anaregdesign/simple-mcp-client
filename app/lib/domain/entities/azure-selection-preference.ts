import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";
import type { ThemeMode } from "~/lib/domain/value-objects/theme-mode";
import { DomainError } from "~/lib/domain/entities/domain-error";

export type AzureSelectionTargetPreference = {
  projectId: string;
  deploymentName: string;
};

export type AzureUtilitySelectionTargetPreference = AzureSelectionTargetPreference & {
  reasoningEffort: ReasoningEffort;
};

export type AzureSelectionPreferenceSnapshot = {
  tenantId: string;
  principalId: string;
  theme: ThemeMode;
  playground: AzureSelectionTargetPreference | null;
  utility: AzureUtilitySelectionTargetPreference | null;
};

export class AzureSelectionPreference {
  readonly tenantId: string;
  readonly principalId: string;
  readonly theme: ThemeMode;
  readonly playground: AzureSelectionTargetPreference | null;
  readonly utility: AzureUtilitySelectionTargetPreference | null;

  constructor(snapshot: AzureSelectionPreferenceSnapshot) {
    const tenantId = snapshot.tenantId.trim();
    const principalId = snapshot.principalId.trim();
    if (!tenantId) {
      throw new DomainError(
        "azure_selection_preference_tenant_id_required",
        "AzureSelectionPreference tenantId is required.",
      );
    }
    if (!principalId) {
      throw new DomainError(
        "azure_selection_preference_principal_id_required",
        "AzureSelectionPreference principalId is required.",
      );
    }

    this.tenantId = tenantId;
    this.principalId = principalId;
    this.theme = snapshot.theme;
    this.playground = snapshot.playground
      ? {
          projectId: snapshot.playground.projectId.trim(),
          deploymentName: snapshot.playground.deploymentName.trim(),
        }
      : null;
    this.utility = snapshot.utility
      ? {
          projectId: snapshot.utility.projectId.trim(),
          deploymentName: snapshot.utility.deploymentName.trim(),
          reasoningEffort: snapshot.utility.reasoningEffort,
        }
      : null;
  }

  static fromSnapshot(snapshot: AzureSelectionPreferenceSnapshot): AzureSelectionPreference {
    return new AzureSelectionPreference(snapshot);
  }

  hasSelection(): boolean {
    return this.playground !== null || this.utility !== null;
  }

  toSnapshot(): AzureSelectionPreferenceSnapshot {
    return {
      tenantId: this.tenantId,
      principalId: this.principalId,
      theme: this.theme,
      playground: this.playground ? { ...this.playground } : null,
      utility: this.utility ? { ...this.utility } : null,
    };
  }

  toJSON(): AzureSelectionPreferenceSnapshot {
    return this.toSnapshot();
  }
}
