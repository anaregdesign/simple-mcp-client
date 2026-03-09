import type { WorkspaceMcpServerProfile } from "~/lib/domain/entities/workspace-mcp-server-profile";

export interface WorkspaceMcpServerProfileRepository {
  listByUserId(userId: number): Promise<WorkspaceMcpServerProfile[]>;
  replaceByUserId(
    userId: number,
    profiles: WorkspaceMcpServerProfile[],
  ): Promise<void>;
}
