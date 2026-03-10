/**
 * API route module for /api/azure/selection.
 */
import {
  authRequiredResponse,
  methodNotAllowedResponse,
} from "~/lib/server/infrastructure/http/route-transport";
import {
  handleAzureSelectionAction,
  handleAzureSelectionLoader,
} from "~/lib/server/infrastructure/azure/azure-selection-action";
import { readAuthenticatedIdentity } from "~/lib/server/infrastructure/auth/read-authenticated-identity";
import {
  installGlobalServerErrorLogging,
} from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import {
  createAzureSelectionServiceWithInfrastructure,
} from "~/lib/server/infrastructure/azure/azure-service-factory";
import type { Route } from "./+types/api.azure.selection";

const AZURE_SELECTION_ALLOWED_METHODS = ["GET", "PATCH", "DELETE"] as const;

export async function loader({ request }: Route.LoaderArgs) {
  installGlobalServerErrorLogging();

  if (request.method !== "GET") {
    return methodNotAllowedResponse(AZURE_SELECTION_ALLOWED_METHODS);
  }

  const identity = await readAuthenticatedIdentity();
  if (!identity) {
    return authRequiredResponse();
  }

  return handleAzureSelectionLoader({
    request,
    identity,
    azureSelectionService: createAzureSelectionServiceWithInfrastructure(),
  });
}

export async function action({ request }: Route.ActionArgs) {
  installGlobalServerErrorLogging();

  if (request.method !== "PATCH" && request.method !== "DELETE") {
    return methodNotAllowedResponse(AZURE_SELECTION_ALLOWED_METHODS);
  }

  const identity = await readAuthenticatedIdentity();
  if (!identity) {
    return authRequiredResponse();
  }

  return handleAzureSelectionAction({
    request,
    identity,
    azureSelectionService: createAzureSelectionServiceWithInfrastructure(),
  });
}
