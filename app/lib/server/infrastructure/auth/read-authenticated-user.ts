import { readAzureArmUserContext } from "~/lib/server/auth/azure-user";
import { getOrCreateUserByIdentity } from "~/lib/server/infrastructure/persistence/user";

export type AuthenticatedUser = {
  id: number;
};

export async function readAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const userContext = await readAzureArmUserContext();
  if (!userContext) {
    return null;
  }

  const user = await getOrCreateUserByIdentity({
    tenantId: userContext.tenantId,
    principalId: userContext.principalId,
  });

  return {
    id: user.id,
  };
}
