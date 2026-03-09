import type { AzureSelectionPreference } from "~/lib/domain/entities/azure-selection-preference";

export type AzureSelectionIdentity = {
  tenantId: string;
  principalId: string;
};

export interface AzureSelectionPreferenceRepository {
  findByIdentity(
    identity: AzureSelectionIdentity,
  ): Promise<AzureSelectionPreference | null>;
  save(
    preference: AzureSelectionPreference,
  ): Promise<AzureSelectionPreference>;
  deleteByIdentity(identity: AzureSelectionIdentity): Promise<boolean>;
}
