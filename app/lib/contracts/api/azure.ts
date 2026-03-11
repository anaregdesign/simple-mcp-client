import type { AzurePrincipalType } from "~/lib/domain/value-objects/azure-principal-type";
import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";
import type { ThemeMode } from "~/lib/domain/value-objects/theme-mode";

export type AzurePrincipalProfileResource = {
  tenantId: string;
  principalId: string;
  displayName: string;
  principalName: string;
  principalType: AzurePrincipalType;
};

export type AzureProjectResource = {
  id: string;
  projectName: string;
  baseUrl: string;
  apiVersion: string;
};

export type AzureDeploymentResource = {
  name: string;
  reasoningEffortOptions: ReasoningEffort[];
};

export type AzureTenantResource = {
  tenantId: string;
  displayName: string;
  defaultDomain: string;
};

export type AzureSelectionTargetPreferenceResource = {
  projectId: string;
  deploymentName: string;
};

export type AzureUtilitySelectionTargetPreferenceResource =
  AzureSelectionTargetPreferenceResource & {
    reasoningEffort: ReasoningEffort;
  };

export type AzureSelectionPreferenceResource = {
  tenantId: string;
  principalId: string;
  theme: ThemeMode;
  playground: AzureSelectionTargetPreferenceResource | null;
  utility: AzureUtilitySelectionTargetPreferenceResource | null;
};

export type AzureSelectionUpdatePayload =
  | {
      target: "playground";
      projectId: string;
      deploymentName: string;
      theme?: ThemeMode | null;
    }
  | {
      target: "utility";
      projectId: string;
      deploymentName: string;
      reasoningEffort: ReasoningEffort;
      theme?: ThemeMode | null;
    }
  | {
      theme: ThemeMode;
    };
