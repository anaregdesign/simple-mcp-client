import type { WorkspaceMcpServerProfileResource } from "~/lib/contracts/mcp/profile";

export interface WorkspaceMcpServerProfileRepository {
  listByUserId(userId: number): Promise<WorkspaceMcpServerProfileResource[]>;
  replaceByUserId(
    userId: number,
    profiles: WorkspaceMcpServerProfileResource[],
  ): Promise<void>;
}
