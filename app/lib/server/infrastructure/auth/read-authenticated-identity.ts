import { readAzureArmUserContext } from "~/lib/server/infrastructure/auth/azure-arm-user-context";

export type AuthenticatedIdentity = {
  tenantId: string;
  principalId: string;
};

export async function readAuthenticatedIdentity(): Promise<AuthenticatedIdentity | null> {
  const context = await readAzureArmUserContext();
  if (!context) {
    return null;
  }

  return {
    tenantId: context.tenantId,
    principalId: context.principalId,
  };
}
