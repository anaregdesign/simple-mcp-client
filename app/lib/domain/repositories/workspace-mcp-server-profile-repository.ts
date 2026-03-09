import type { WorkspaceMcpServerProfileResource as WorkspaceMcpServerProfile } from "~/lib/contracts/mcp/profile";

export interface WorkspaceMcpServerProfileRepository {
  listByUserId(userId: number): Promise<WorkspaceMcpServerProfile[]>;
  replaceByUserId(
    userId: number,
    profiles: WorkspaceMcpServerProfile[],
  ): Promise<void>;
}
