/**
 * API route module for /api/azure/session.
 */
import { AZURE_ARM_SCOPE } from "~/lib/constants/azure";
import { azureSessionService } from "~/lib/server/usecase/azure/azure-session-service";
import { errorResponse, methodNotAllowedResponse } from "~/lib/server/http";
import {
  installGlobalServerErrorLogging,
  logServerRouteEvent,
} from "~/lib/server/observability/runtime-event-log";
import type { Route } from "./+types/api.azure.session";

const AZURE_SESSION_ALLOWED_METHODS = ["PUT", "DELETE"] as const;
const AZURE_SESSION_INVALID_BODY_ERROR = "Invalid request body.";

export function loader() {
  installGlobalServerErrorLogging();
  return methodNotAllowedResponse(AZURE_SESSION_ALLOWED_METHODS);
}

export async function action({ request }: Route.ActionArgs) {
  installGlobalServerErrorLogging();

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
        route: "/api/azure/session",
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
      route: "/api/azure/session",
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

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error.";
}

async function readAzureSessionPutTenantId(
  request: Request,
): Promise<{ ok: true; tenantId: string } | { ok: false; error: string }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return { ok: true, tenantId: "" };
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return { ok: false, error: AZURE_SESSION_INVALID_BODY_ERROR };
  }

  if (!isRecord(payload)) {
    return { ok: false, error: AZURE_SESSION_INVALID_BODY_ERROR };
  }

  const tenantId = typeof payload.tenantId === "string" ? payload.tenantId.trim() : "";
  return { ok: true, tenantId };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
