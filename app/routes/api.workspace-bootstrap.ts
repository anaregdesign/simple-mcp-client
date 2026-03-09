import {
  handleWorkspaceBootstrapLoader,
} from "~/lib/server/http/workspace/workspace-bootstrap-loader";
import {
  installGlobalServerErrorLogging,
} from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import {
  createWorkspaceBootstrapServiceWithInfrastructure,
} from "~/lib/server/infrastructure/workspace/workspace-bootstrap-service-factory";
import type { Route } from "./+types/api.workspace-bootstrap";

export async function loader({ request }: Route.LoaderArgs) {
  installGlobalServerErrorLogging();
  return handleWorkspaceBootstrapLoader({
    request,
    workspaceBootstrapService: createWorkspaceBootstrapServiceWithInfrastructure(),
  });
}
