/**
 * API route module for /api/threads/title-suggestions.
 */
import type { Route } from "./+types/api.threads.title-suggestions";
import {
  createThreadTitleGenerationGateway,
} from "~/lib/server/infrastructure/gateways/chat/thread-title-generation-gateway";
import {
  installGlobalServerErrorLogging,
  logServerRouteEvent,
} from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import {
  errorResponse,
  invalidJsonResponse,
  methodNotAllowedResponse,
  validationErrorResponse,
} from "~/lib/server/http";
import {
  readThreadTitleSuggestionRequest,
} from "~/lib/server/http/threads/thread-title-suggestion-request";
import { buildThreadTitleUpstreamError } from "~/lib/server/http/threads/thread-title-upstream-error";
import {
  createThreadTitleSuggestionService,
} from "~/lib/server/usecase/threads/thread-title-suggestion-service";

const THREAD_TITLE_SUGGESTIONS_ALLOWED_METHODS = ["POST"] as const;

function getThreadTitleSuggestionService() {
  return createThreadTitleSuggestionService(createThreadTitleGenerationGateway());
}

export function loader({}: Route.LoaderArgs) {
  installGlobalServerErrorLogging();

  return methodNotAllowedResponse(THREAD_TITLE_SUGGESTIONS_ALLOWED_METHODS);
}

export async function action({ request }: Route.ActionArgs) {
  installGlobalServerErrorLogging();

  if (request.method !== "POST") {
    return methodNotAllowedResponse(THREAD_TITLE_SUGGESTIONS_ALLOWED_METHODS);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    await logServerRouteEvent({
      request,
      route: "/api/threads/title-suggestions",
      eventName: "invalid_json_body",
      action: "parse_request_body",
      level: "warning",
      statusCode: 400,
      message: "Invalid JSON body.",
    });

    return invalidJsonResponse();
  }

  const titleSuggestionRequest = readThreadTitleSuggestionRequest(payload);
  if (!titleSuggestionRequest.ok) {
    await logServerRouteEvent({
      request,
      route: "/api/threads/title-suggestions",
      eventName: titleSuggestionRequest.issue.eventName,
      action: titleSuggestionRequest.issue.action,
      level: "warning",
      statusCode: titleSuggestionRequest.issue.statusCode,
      message: titleSuggestionRequest.issue.message,
    });

    return validationErrorResponse(
      titleSuggestionRequest.issue.code,
      titleSuggestionRequest.issue.error,
    );
  }

  try {
    const title = await getThreadTitleSuggestionService().generateTitle(
      titleSuggestionRequest.value,
    );
    return Response.json({ title });
  } catch (error) {
    const upstreamError = buildThreadTitleUpstreamError(
      error,
      titleSuggestionRequest.value.azureConfig.deploymentName,
    );
    await logServerRouteEvent({
      request,
      route: "/api/threads/title-suggestions",
      eventName: "generate_thread_title_failed",
      action: "generate_thread_title",
      statusCode: upstreamError.status,
      error,
      context: {
        projectName: titleSuggestionRequest.value.azureConfig.projectName,
        deploymentName: titleSuggestionRequest.value.azureConfig.deploymentName,
      },
    });

    return errorResponse({
      status: upstreamError.status,
      code: upstreamError.payload.code,
      error: upstreamError.payload.error,
      extras: upstreamError.payload.errorCode
        ? {
            errorCode: upstreamError.payload.errorCode,
          }
        : undefined,
    });
  }
}
