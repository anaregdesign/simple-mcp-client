import { AZURE_ARM_SCOPE } from "~/lib/constants/azure";
import {
  errorResponse,
  methodNotAllowedResponse,
  readErrorMessage,
} from "~/lib/server/http";
import { readAzureSessionPutTenantId } from "~/lib/server/http/azure/azure-session-request";
import { logServerRouteEvent } from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import type { AzureSessionService } from "~/lib/server/usecase/azure/azure-session-service";

const AZURE_SESSION_ALLOWED_METHODS = ["PUT", "DELETE"] as const;
const AZURE_SESSION_ROUTE_PATH = "/api/azure/session";

export function handleAzureSessionLoader(): Response {
  return methodNotAllowedResponse(AZURE_SESSION_ALLOWED_METHODS);
}

export async function handleAzureSessionAction(options: {
  request: Request;
  azureSessionService: AzureSessionService;
}): Promise<Response> {
  const { request, azureSessionService } = options;

  if (request.method !== "PUT" && request.method !== "DELETE") {
    return methodNotAllowedResponse(AZURE_SESSION_ALLOWED_METHODS);
  }

  if (request.method === "PUT") {
    const tenantIdResult = await readAzureSessionPutTenantId(request);
    if (!tenantIdResult.ok) {
      return errorResponse({
        status: 400,
        code: "invalid_request_body",
        error: tenantIdResult.error,
      });
    }

    const tenantId = tenantIdResult.tenantId;

    try {
      await azureSessionService.startSession(tenantId);

      return Response.json({
        message: "Azure login completed. Azure projects were refreshed.",
      });
    } catch (error) {
      await logServerRouteEvent({
        request,
        route: AZURE_SESSION_ROUTE_PATH,
        eventName: "azure_login_start_failed",
        action: "authenticate_interactive_browser_credential",
        statusCode: 500,
        error,
        context: {
          scope: AZURE_ARM_SCOPE,
          requestedTenantId: tenantId || null,
        },
      });

      return errorResponse({
        status: 500,
        code: "azure_login_start_failed",
        error: `Failed to run Azure login: ${readErrorMessage(error)}. Retry and complete sign-in in the browser.`,
      });
    }
  }

  try {
    azureSessionService.endSession();

    return Response.json({
      message: "Azure logout completed. Sign in again when needed.",
    });
  } catch (error) {
    await logServerRouteEvent({
      request,
      route: AZURE_SESSION_ROUTE_PATH,
      eventName: "azure_logout_failed",
      action: "reset_azure_dependencies",
      statusCode: 500,
      error,
    });

    return errorResponse({
      status: 500,
      code: "azure_logout_failed",
      error: `Failed to reset Azure authentication state: ${readErrorMessage(error)}`,
    });
  }
}
