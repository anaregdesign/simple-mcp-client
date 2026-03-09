/**
 * API route module for /api/azure/selection.
 */
import {
  createAzureSelectionService,
} from "~/lib/server/usecase/azure/azure-selection-service";
import {
  authRequiredResponse,
  methodNotAllowedResponse,
} from "~/lib/server/http";
import {
  handleAzureSelectionAction,
  handleAzureSelectionLoader,
} from "~/lib/server/http/azure/azure-selection-action";
import { readAuthenticatedIdentity } from "~/lib/server/infrastructure/auth/read-authenticated-identity";
import {
  createAzureSelectionPreferencePersistenceRepository,
} from "~/lib/server/infrastructure/repositories/azure-selection-preference-persistence-repository";
import {
  installGlobalServerErrorLogging,
} from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import type { Route } from "./+types/api.azure.selection";

const AZURE_SELECTION_ALLOWED_METHODS = ["GET", "PATCH", "DELETE"] as const;

function getAzureSelectionService() {
  return createAzureSelectionService(
    createAzureSelectionPreferencePersistenceRepository(),
  );
}

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
    azureSelectionService: getAzureSelectionService(),
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
    azureSelectionService: getAzureSelectionService(),
  });
}
