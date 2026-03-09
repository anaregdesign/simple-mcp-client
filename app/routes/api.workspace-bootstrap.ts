import {
  handleWorkspaceBootstrapLoader,
} from "~/lib/server/http/workspace/workspace-bootstrap-loader";
import {
  createWorkspaceBootstrapService,
} from "~/lib/server/usecase/workspace/workspace-bootstrap-service";
import {
  createAzureSelectionService,
} from "~/lib/server/usecase/azure/azure-selection-service";
import {
  createMcpServerProfileService,
} from "~/lib/server/usecase/mcp/mcp-server-profile-service";
import {
  createThreadQueryService,
} from "~/lib/server/usecase/threads/thread-service";
import {
  createWorkspaceSkillService,
} from "~/lib/server/usecase/skills/workspace-skill-service";
import {
  createAzureArmPagedFetchGateway,
} from "~/lib/server/infrastructure/gateways/azure/arm-paged-fetch-gateway";
import {
  createAzureArmAccessGateway,
} from "~/lib/server/infrastructure/azure/arm-access-context";
import {
  createAzureSelectionPreferencePersistenceRepository,
} from "~/lib/server/infrastructure/repositories/azure-selection-preference-persistence-repository";
import {
  createAzureProjectQueryService,
} from "~/lib/server/usecase/azure/azure-project-service";
import {
  createWorkspaceMcpServerProfilePersistenceRepository,
} from "~/lib/server/infrastructure/repositories/workspace-mcp-server-profile-persistence-repository";
import {
  createThreadPersistenceRepository,
} from "~/lib/server/infrastructure/repositories/thread-persistence-repository";
import {
  installGlobalServerErrorLogging,
  logServerRouteEvent,
} from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import {
  createWorkspaceSkillServiceWithInfrastructure,
} from "~/lib/server/infrastructure/skills/workspace-skill-service-factory";
import type { Route } from "./+types/api.workspace-bootstrap";

function getWorkspaceBootstrapService() {
  return createWorkspaceBootstrapService({
    azureArmAccessGateway: createAzureArmAccessGateway(),
    azureProjectQueryService: createAzureProjectQueryService({
      logEvent: logServerRouteEvent,
      armPagedFetchGateway: createAzureArmPagedFetchGateway(),
    }),
    azureSelectionService: createAzureSelectionService(
      createAzureSelectionPreferencePersistenceRepository(),
    ),
    mcpServerProfileService: createMcpServerProfileService(
      createWorkspaceMcpServerProfilePersistenceRepository(),
    ),
    threadQueryService: createThreadQueryService(
      createThreadPersistenceRepository(),
    ),
    workspaceSkillService: createWorkspaceSkillServiceWithInfrastructure(),
  });
}

export async function loader({ request }: Route.LoaderArgs) {
  installGlobalServerErrorLogging();
  return handleWorkspaceBootstrapLoader({
    request,
    workspaceBootstrapService: getWorkspaceBootstrapService(),
  });
}
