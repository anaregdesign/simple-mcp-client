import { readAuthenticatedIdentity } from "~/lib/server/infrastructure/auth/read-authenticated-identity";
import { getOrCreateUserByIdentity } from "~/lib/server/infrastructure/persistence/user";

export type AuthenticatedUser = {
  id: number;
};

export type AuthenticatedWorkspaceUser = AuthenticatedUser & {
  tenantId: string;
  principalId: string;
};

export async function readAuthenticatedWorkspaceUser(): Promise<AuthenticatedWorkspaceUser | null> {
  const identity = await readAuthenticatedIdentity();
  if (!identity) {
    return null;
  }

  const user = await getOrCreateUserByIdentity(identity);

  return {
    id: user.id,
    tenantId: identity.tenantId,
    principalId: identity.principalId,
  };
}

export async function readAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const user = await readAuthenticatedWorkspaceUser();
  if (!user) {
    return null;
  }

  return {
    id: user.id,
  };
}
