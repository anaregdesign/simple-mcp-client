import { readAzureArmUserContext } from "~/lib/server/auth/azure-user";

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
