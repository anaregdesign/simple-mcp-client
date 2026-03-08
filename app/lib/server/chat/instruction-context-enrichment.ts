/**
 * Server chat instruction-context enrichment helpers.
 */
import { readAzureArmUserContext } from "~/lib/server/auth/azure-user";
import { resolveWorkspaceThreadDirectory, resolveWorkspaceUserDirectory } from "~/lib/server/infrastructure/config/workspace-storage-paths";
import { ensurePersistenceDatabaseReady, prisma } from "~/lib/server/persistence/prisma";
import { getOrCreateUserByIdentity } from "~/lib/server/persistence/user";

export type ThreadDirectoryContext = {
  userId: number;
  userDirectoryPath: string;
  threadDirectoryPath: string | null;
};

export type InstructionSelectionContext = {
  projectId: string | null;
  deploymentName: string | null;
};

export async function resolveThreadDirectoryContext(options: {
  threadId: string | null;
  tenantId: string;
}): Promise<ThreadDirectoryContext | null> {
  try {
    const azureContext = await readAzureArmUserContext(undefined, options.tenantId);
    if (!azureContext) {
      return null;
    }

    const user = await getOrCreateUserByIdentity({
      tenantId: azureContext.tenantId,
      principalId: azureContext.principalId,
    });
    return {
      userId: user.id,
      userDirectoryPath: resolveWorkspaceUserDirectory({
        workspaceUserId: user.id,
      }),
      threadDirectoryPath: resolveThreadDirectoryPath({
        userId: user.id,
        threadId: options.threadId,
      }),
    };
  } catch {
    return null;
  }
}

export function resolveThreadDirectoryPath(options: {
  userId: number;
  threadId: string | null;
}): string | null {
  if (!options.threadId) {
    return null;
  }

  try {
    return resolveWorkspaceThreadDirectory({
      workspaceUserId: options.userId,
      threadId: options.threadId,
    });
  } catch {
    return null;
  }
}

export async function readLatestThreadNameForInstruction(
  userId: number,
): Promise<string | null> {
  await ensurePersistenceDatabaseReady();
  const latestThread = await prisma.thread.findFirst({
    where: {
      userId,
      deletedAt: null,
    },
    orderBy: [{ updatedAt: "desc" }],
    select: {
      name: true,
    },
  });

  return normalizeOptionalInstructionLabel(latestThread?.name);
}

export async function readPlaygroundSelectionForInstruction(
  userId: number,
): Promise<InstructionSelectionContext> {
  await ensurePersistenceDatabaseReady();
  const selection = await prisma.azureSelectionPreference.findUnique({
    where: {
      userId,
    },
    select: {
      projectId: true,
      deploymentName: true,
    },
  });

  return {
    projectId: normalizeOptionalInstructionLabel(selection?.projectId),
    deploymentName: normalizeOptionalInstructionLabel(selection?.deploymentName),
  };
}

function normalizeOptionalInstructionLabel(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}
