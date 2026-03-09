/**
 * API route module for /api/azure/session.
 */
import {
  createAzureSessionService,
} from "~/lib/server/usecase/azure/azure-session-service";
import {
  installGlobalServerErrorLogging,
} from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import {
  createAzureSessionGateway,
} from "~/lib/server/infrastructure/gateways/azure/azure-session-gateway";
import {
  handleAzureSessionAction,
  handleAzureSessionLoader,
} from "~/lib/server/http/azure/azure-session-action";
import type { Route } from "./+types/api.azure.session";

function getAzureSessionService() {
  return createAzureSessionService(createAzureSessionGateway());
}

export function loader() {
  installGlobalServerErrorLogging();
  return handleAzureSessionLoader();
}

export async function action({ request }: Route.ActionArgs) {
  installGlobalServerErrorLogging();
  return handleAzureSessionAction({
    request,
    azureSessionService: getAzureSessionService(),
  });
}
