/**
 * API route module for /api/azure/session.
 */
import {
  installGlobalServerErrorLogging,
} from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import {
  handleAzureSessionAction,
  handleAzureSessionLoader,
} from "~/lib/server/http/azure/azure-session-action";
import {
  createAzureSessionServiceWithInfrastructure,
} from "~/lib/server/infrastructure/azure/azure-service-factory";
import type { Route } from "./+types/api.azure.session";

export function loader() {
  installGlobalServerErrorLogging();
  return handleAzureSessionLoader();
}

export async function action({ request }: Route.ActionArgs) {
  installGlobalServerErrorLogging();
  return handleAzureSessionAction({
    request,
    azureSessionService: createAzureSessionServiceWithInfrastructure(),
  });
}
