import type { WorkspaceMcpServerProfileResource } from "~/lib/contracts/mcp/profile";
import type { WorkspaceMcpServerProfileRepository } from "~/lib/domain/repositories/workspace-mcp-server-profile-repository";
import {
  ensurePersistenceDatabaseReady,
  prisma,
} from "~/lib/server/infrastructure/persistence/prisma";

export class WorkspaceMcpServerProfilePersistenceRepository
  implements WorkspaceMcpServerProfileRepository
{
  async listByUserId(userId: number): Promise<WorkspaceMcpServerProfileResource[]> {
    await ensurePersistenceDatabaseReady();
    return prisma.workspaceMcpServerProfile.findMany({
      where: {
        userId,
      },
      orderBy: {
        profileOrder: "asc",
      },
    });
  }

  async replaceByUserId(
    userId: number,
    profiles: WorkspaceMcpServerProfileResource[],
  ): Promise<void> {
    await ensurePersistenceDatabaseReady();
    await prisma.$transaction(async (transaction) => {
      await transaction.workspaceMcpServerProfile.deleteMany({
        where: { userId },
      });
      if (profiles.length === 0) {
        return;
      }

      await transaction.workspaceMcpServerProfile.createMany({
        data: profiles,
      });
    });
  }
}

export function createWorkspaceMcpServerProfilePersistenceRepository(): WorkspaceMcpServerProfileRepository {
  return new WorkspaceMcpServerProfilePersistenceRepository();
}
