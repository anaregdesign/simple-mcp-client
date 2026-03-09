import {
  createWorkspaceMcpServerProfilePersistenceRepository,
} from "~/lib/server/infrastructure/repositories/workspace-mcp-server-profile-persistence-repository";
import {
  createMcpServerProfileService,
} from "~/lib/server/usecase/mcp/mcp-server-profile-service";

export function createMcpServerProfileServiceWithInfrastructure() {
  return createMcpServerProfileService(
    createWorkspaceMcpServerProfilePersistenceRepository(),
  );
}
