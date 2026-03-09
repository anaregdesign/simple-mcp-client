import {
  errorResponse,
  invalidJsonResponse,
  readErrorMessage,
  readJsonPayload,
  validationErrorResponse,
} from "~/lib/server/http";
import { presentAzureSelectionPreferenceResource } from "~/lib/server/http/azure/azure-presentation";
import { parseAzureSelectionPreferenceRequest } from "~/lib/server/http/azure/azure-selection-request";
import { logServerRouteEvent } from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import type {
  AzureSelectionIdentity,
} from "~/lib/domain/repositories/azure-selection-preference-repository";
import type { AzureSelectionService } from "~/lib/server/usecase/azure/azure-selection-service";

const AZURE_SELECTION_ROUTE_PATH = "/api/azure/selection";
const INVALID_SELECTION_PAYLOAD_MESSAGE =
  "Provide valid selection fields (`target`, `projectId`, `deploymentName`, and utility `reasoningEffort`) or `theme` only.";

export async function handleAzureSelectionLoader(options: {
  request: Request;
  identity: AzureSelectionIdentity;
  azureSelectionService: AzureSelectionService;
}): Promise<Response> {
  const { request, identity, azureSelectionService } = options;

  try {
    const selection = await azureSelectionService.readStoredSelection(identity);
    return Response.json({
      selection: presentAzureSelectionPreferenceResource(selection),
    });
  } catch (error) {
    await logServerRouteEvent({
      request,
      route: AZURE_SELECTION_ROUTE_PATH,
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

export async function handleAzureSelectionAction(options: {
  request: Request;
  identity: AzureSelectionIdentity;
  azureSelectionService: AzureSelectionService;
}): Promise<Response> {
  const { request, identity, azureSelectionService } = options;

  if (request.method === "DELETE") {
    return handleAzureSelectionDelete({
      request,
      identity,
      azureSelectionService,
    });
  }

  const payload = await readJsonPayload(request);
  if (!payload.ok) {
    await logServerRouteEvent({
      request,
      route: AZURE_SELECTION_ROUTE_PATH,
      eventName: "invalid_json_body",
      action: "parse_request_body",
      level: "warning",
      statusCode: 400,
      message: "Invalid JSON body.",
    });

    return invalidJsonResponse();
  }

  const preference = parseAzureSelectionPreferenceRequest(payload.value);
  if (!preference) {
    await logServerRouteEvent({
      request,
      route: AZURE_SELECTION_ROUTE_PATH,
      eventName: "invalid_selection_payload",
      action: "validate_payload",
      level: "warning",
      statusCode: 422,
      message: INVALID_SELECTION_PAYLOAD_MESSAGE,
    });

    return validationErrorResponse(
      "invalid_selection_payload",
      INVALID_SELECTION_PAYLOAD_MESSAGE,
    );
  }

  try {
    const saved = await azureSelectionService.saveStoredSelection(
      identity,
      preference,
    );
    return Response.json(
      {
        selection: presentAzureSelectionPreferenceResource(saved.selection),
      },
      {
        status: saved.created ? 201 : 200,
        headers: saved.created
          ? {
              Location: AZURE_SELECTION_ROUTE_PATH,
            }
          : undefined,
      },
    );
  } catch (error) {
    await logServerRouteEvent({
      request,
      route: AZURE_SELECTION_ROUTE_PATH,
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

async function handleAzureSelectionDelete(options: {
  request: Request;
  identity: AzureSelectionIdentity;
  azureSelectionService: AzureSelectionService;
}): Promise<Response> {
  const { request, identity, azureSelectionService } = options;

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
      route: AZURE_SELECTION_ROUTE_PATH,
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
