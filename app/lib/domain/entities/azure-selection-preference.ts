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

export type AzureSelectionPreferenceProps = {
  tenantId: string;
  principalId: string;
  theme: ThemeMode;
  playground: AzureSelectionTargetPreference | null;
  utility: AzureUtilitySelectionTargetPreference | null;
};

export type AzureSelectionPreferenceChanges = {
  theme?: ThemeMode;
  playground?: AzureSelectionTargetPreference | null;
  utility?: AzureUtilitySelectionTargetPreference | null;
};

export class AzureSelectionPreference {
  private readonly props: AzureSelectionPreferenceProps;

  constructor(props: AzureSelectionPreferenceProps) {
    const tenantId = props.tenantId.trim();
    const principalId = props.principalId.trim();
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

    this.props = {
      tenantId,
      principalId,
      theme: props.theme,
      playground: normalizeAzureSelectionTargetPreference(props.playground),
      utility: normalizeAzureUtilitySelectionTargetPreference(props.utility),
    };
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get principalId(): string {
    return this.props.principalId;
  }

  get theme(): ThemeMode {
    return this.props.theme;
  }

  get playground(): AzureSelectionTargetPreference | null {
    return this.props.playground ? { ...this.props.playground } : null;
  }

  get utility(): AzureUtilitySelectionTargetPreference | null {
    return this.props.utility ? { ...this.props.utility } : null;
  }

  hasSelection(): boolean {
    return this.props.playground !== null || this.props.utility !== null;
  }

  withChanges(changes: AzureSelectionPreferenceChanges): AzureSelectionPreference {
    return new AzureSelectionPreference({
      tenantId: this.tenantId,
      principalId: this.principalId,
      theme: changes.theme ?? this.theme,
      playground:
        changes.playground === undefined ? this.playground : changes.playground,
      utility: changes.utility === undefined ? this.utility : changes.utility,
    });
  }
}

export function createAzureSelectionTargetPreference(
  projectId: string,
  deploymentName: string,
): AzureSelectionTargetPreference | null {
  return normalizeAzureSelectionTargetPreference({
    projectId,
    deploymentName,
  });
}

export function createAzureUtilitySelectionTargetPreference(
  projectId: string,
  deploymentName: string,
  reasoningEffort: ReasoningEffort | null,
): AzureUtilitySelectionTargetPreference | null {
  return normalizeAzureUtilitySelectionTargetPreference({
    projectId,
    deploymentName,
    reasoningEffort: reasoningEffort ?? "high",
  });
}

function normalizeAzureSelectionTargetPreference(
  value: AzureSelectionTargetPreference | null,
): AzureSelectionTargetPreference | null {
  if (!value) {
    return null;
  }

  const projectId = value.projectId.trim();
  const deploymentName = value.deploymentName.trim();
  if (!projectId || !deploymentName) {
    return null;
  }

  return {
    projectId,
    deploymentName,
  };
}

function normalizeAzureUtilitySelectionTargetPreference(
  value: AzureUtilitySelectionTargetPreference | null,
): AzureUtilitySelectionTargetPreference | null {
  if (!value) {
    return null;
  }

  const base = normalizeAzureSelectionTargetPreference(value);
  if (!base) {
    return null;
  }

  return {
    ...base,
    reasoningEffort: value.reasoningEffort,
  };
}
