import { structuredAuthRequiredResponse, structuredErrorResponse, methodNotAllowedResponse, successResponse } from "~/lib/server/http";
import { readAuthenticatedWorkspaceUser } from "~/lib/server/infrastructure/auth/read-authenticated-user";
import { workspaceBootstrapService } from "~/lib/server/usecase/workspace/workspace-bootstrap-service";
import {
  installGlobalServerErrorLogging,
  logServerRouteEvent,
} from "~/lib/server/observability/runtime-event-log";
import type { Route } from "./+types/api.workspace-bootstrap";

const WORKSPACE_BOOTSTRAP_ALLOWED_METHODS = ["GET"] as const;

export async function loader({ request }: Route.LoaderArgs) {
  installGlobalServerErrorLogging();

  if (request.method !== "GET") {
    return methodNotAllowedResponse(WORKSPACE_BOOTSTRAP_ALLOWED_METHODS);
  }

  const user = await readAuthenticatedWorkspaceUser();
  if (!user) {
    return structuredAuthRequiredResponse();
  }

  try {
    const data = await workspaceBootstrapService.loadWorkspaceBootstrap({ request, user });
    if (!data) {
      return structuredAuthRequiredResponse();
    }

    return successResponse(data);
  } catch (error) {
    await logServerRouteEvent({
      request,
      route: "/api/workspace-bootstrap",
      eventName: "load_workspace_bootstrap_failed",
      action: "load_workspace_bootstrap",
      statusCode: 500,
      error,
    });

    return structuredErrorResponse({
      status: 500,
      code: "load_workspace_bootstrap_failed",
      message:
        error instanceof Error && error.message.trim()
          ? error.message
          : "Failed to load workspace bootstrap data.",
    });
  }
}
