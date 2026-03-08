/**
 * API route module for /api/azure/selection.
 */
import {
  azureSelectionService,
  parseAzureSelectionPreference,
  readAuthenticatedIdentity,
  readErrorMessage,
} from "~/lib/server/application/azure/azure-selection-service";
import {
  authRequiredResponse,
  errorResponse,
  invalidJsonResponse,
  methodNotAllowedResponse,
  validationErrorResponse,
} from "~/lib/server/http";
import {
  installGlobalServerErrorLogging,
  logServerRouteEvent,
} from "~/lib/server/observability/runtime-event-log";
import type { Route } from "./+types/api.azure.selection";

export { parseAzureSelectionPreference };

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

  try {
    const selection = await azureSelectionService.readStoredSelection(identity);
    return Response.json({ selection });
  } catch (error) {
    await logServerRouteEvent({
      request,
      route: "/api/azure/selection",
      eventName: "read_azure_selection_failed",
      action: "read_selection",
      statusCode: 500,
      error,
      context: {
        tenantId: identity.tenantId,
        principalId: identity.principalId,
      },
    });

    return errorResponse({
      status: 500,
      code: "read_azure_selection_failed",
      error: `Failed to read Azure selection from database: ${readErrorMessage(error)}`,
    });
  }
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

  if (request.method === "DELETE") {
    try {
      const deleted = await azureSelectionService.deleteStoredSelection(identity);
      if (!deleted) {
        return errorResponse({
          status: 404,
          code: "azure_selection_not_found",
          error: "Azure selection is not available.",
        });
      }

      return new Response(null, { status: 204 });
    } catch (error) {
      await logServerRouteEvent({
        request,
        route: "/api/azure/selection",
        eventName: "delete_azure_selection_failed",
        action: "delete_selection",
        statusCode: 500,
        error,
        context: {
          tenantId: identity.tenantId,
          principalId: identity.principalId,
        },
      });

      return errorResponse({
        status: 500,
        code: "delete_azure_selection_failed",
        error: `Failed to delete Azure selection from database: ${readErrorMessage(error)}`,
      });
    }
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    await logServerRouteEvent({
      request,
      route: "/api/azure/selection",
      eventName: "invalid_json_body",
      action: "parse_request_body",
      level: "warning",
      statusCode: 400,
      message: "Invalid JSON body.",
    });

    return invalidJsonResponse();
  }

  const preference = parseAzureSelectionPreference(payload);
  if (!preference) {
    await logServerRouteEvent({
      request,
      route: "/api/azure/selection",
      eventName: "invalid_selection_payload",
      action: "validate_payload",
      level: "warning",
      statusCode: 422,
      message:
        "Provide valid selection fields (`target`, `projectId`, `deploymentName`, and utility `reasoningEffort`) or `theme` only.",
    });

    return validationErrorResponse(
      "invalid_selection_payload",
      "Provide valid selection fields (`target`, `projectId`, `deploymentName`, and utility `reasoningEffort`) or `theme` only.",
    );
  }

  try {
    const saved = await azureSelectionService.saveStoredSelection(identity, preference);
    return Response.json(
      { selection: saved.selection },
      {
        status: saved.created ? 201 : 200,
        headers: saved.created
          ? {
              Location: "/api/azure/selection",
            }
          : undefined,
      },
    );
  } catch (error) {
    await logServerRouteEvent({
      request,
      route: "/api/azure/selection",
      eventName: "patch_azure_selection_failed",
      action: "patch_selection",
      statusCode: 500,
      error,
      context: {
        tenantId: identity.tenantId,
        principalId: identity.principalId,
        target: preference.target,
        projectId: preference.projectId,
        deploymentName: preference.deploymentName,
        reasoningEffort: preference.reasoningEffort,
        theme: preference.theme,
      },
    });

    return errorResponse({
      status: 500,
      code: "patch_azure_selection_failed",
      error: `Failed to save Azure selection to database: ${readErrorMessage(error)}`,
    });
  }
}
