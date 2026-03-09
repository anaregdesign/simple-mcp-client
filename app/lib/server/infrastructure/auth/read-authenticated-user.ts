import { readAuthenticatedIdentity } from "~/lib/server/infrastructure/auth/read-authenticated-identity";
import { getOrCreateUserByIdentity } from "~/lib/server/infrastructure/persistence/user";

export type AuthenticatedUser = {
  id: number;
};

export async function readAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const identity = await readAuthenticatedIdentity();
  if (!identity) {
    return null;
  }

  const user = await getOrCreateUserByIdentity(identity);

  return {
    id: user.id,
  };
}
