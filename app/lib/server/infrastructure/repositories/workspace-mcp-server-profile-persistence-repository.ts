import type { WorkspaceMcpServerProfile } from "~/lib/domain/entities/workspace-mcp-server-profile";
import type { WorkspaceMcpServerProfileRepository } from "~/lib/domain/repositories/workspace-mcp-server-profile-repository";
import {
  ensurePersistenceDatabaseReady,
  prisma,
} from "~/lib/server/infrastructure/persistence/prisma";

export class WorkspaceMcpServerProfilePersistenceRepository
  implements WorkspaceMcpServerProfileRepository
{
  async listByUserId(userId: number): Promise<WorkspaceMcpServerProfile[]> {
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
    profiles: WorkspaceMcpServerProfile[],
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
