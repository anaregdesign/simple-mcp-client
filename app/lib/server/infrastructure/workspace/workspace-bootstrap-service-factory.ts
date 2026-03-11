import {
  createAzureArmAccessGateway,
} from "~/lib/server/infrastructure/azure/arm-access-context";
import {
  createAzureProjectQueryServiceWithInfrastructure,
  createAzureSelectionServiceWithInfrastructure,
} from "~/lib/server/infrastructure/azure/azure-service-factory";
import {
  createMcpServerProfileServiceWithInfrastructure,
} from "~/lib/server/infrastructure/mcp/mcp-server-profile-service-factory";
import {
  createWorkspaceSkillServiceWithInfrastructure,
} from "~/lib/server/infrastructure/skills/workspace-skill-service-factory";
import {
  createThreadQueryServiceWithInfrastructure,
} from "~/lib/server/infrastructure/threads/thread-service-factory";
import {
  createWorkspaceBootstrapService,
} from "~/lib/server/usecase/workspace/workspace-bootstrap-service";

export function createWorkspaceBootstrapServiceWithInfrastructure() {
  return createWorkspaceBootstrapService({
    azureArmAccessGateway: createAzureArmAccessGateway(),
    azureProjectQueryService: createAzureProjectQueryServiceWithInfrastructure(),
    azureSelectionService: createAzureSelectionServiceWithInfrastructure(),
    mcpServerProfileService: createMcpServerProfileServiceWithInfrastructure(),
    threadQueryService: createThreadQueryServiceWithInfrastructure(),
    workspaceSkillService: createWorkspaceSkillServiceWithInfrastructure(),
  });
}
