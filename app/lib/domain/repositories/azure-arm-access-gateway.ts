import type { AzurePrincipalType } from "~/lib/domain/value-objects/azure-principal-type";

export type AzurePrincipalProfile = {
  tenantId: string;
  principalId: string;
  displayName: string;
  principalName: string;
  principalType: AzurePrincipalType;
};

export type ArmAccessTokenResult =
  | {
      ok: true;
      token: string;
      tenantId: string;
      principalId: string;
      displayName: string;
      principalName: string;
      principalType: AzurePrincipalType;
    }
  | { ok: false };

export interface AzureArmAccessGateway {
  getArmAccessToken(preferredTenantId?: string): Promise<ArmAccessTokenResult>;
  resolveAzurePrincipalProfile(
    accessContext: Extract<ArmAccessTokenResult, { ok: true }>,
  ): Promise<AzurePrincipalProfile>;
}
