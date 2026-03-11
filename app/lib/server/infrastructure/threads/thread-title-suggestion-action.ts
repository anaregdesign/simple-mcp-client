import {
  errorResponse,
  invalidJsonResponse,
  methodNotAllowedResponse,
  readJsonPayload,
  validationErrorResponse,
} from "~/lib/server/infrastructure/http/route-transport";
import {
  readThreadTitleSuggestionRequest,
} from "~/lib/server/infrastructure/threads/thread-title-suggestion-request";
import {
  buildThreadTitleUpstreamError,
} from "~/lib/server/infrastructure/threads/thread-title-upstream-error";
import { logServerRouteEvent } from "~/lib/server/infrastructure/gateways/observability/runtime-event-log-gateway";
import type { ThreadTitleSuggestionService } from "~/lib/server/usecase/threads/thread-title-suggestion-service";

const THREAD_TITLE_SUGGESTIONS_ALLOWED_METHODS = ["POST"] as const;
const THREAD_TITLE_SUGGESTIONS_ROUTE_PATH = "/api/threads/title-suggestions";

export function handleThreadTitleSuggestionLoader(): Response {
  return methodNotAllowedResponse(THREAD_TITLE_SUGGESTIONS_ALLOWED_METHODS);
}

export async function handleThreadTitleSuggestionAction(options: {
  request: Request;
  threadTitleSuggestionService: ThreadTitleSuggestionService;
}): Promise<Response> {
  const { request, threadTitleSuggestionService } = options;

  if (request.method !== "POST") {
    return methodNotAllowedResponse(THREAD_TITLE_SUGGESTIONS_ALLOWED_METHODS);
  }

  const payload = await readJsonPayload(request);
  if (!payload.ok) {
    await logServerRouteEvent({
      request,
      route: THREAD_TITLE_SUGGESTIONS_ROUTE_PATH,
      eventName: "invalid_json_body",
      action: "parse_request_body",
      level: "warning",
      statusCode: 400,
      message: "Invalid JSON body.",
    });

    return invalidJsonResponse();
  }

  const titleSuggestionRequest = readThreadTitleSuggestionRequest(payload.value);
  if (!titleSuggestionRequest.ok) {
    await logServerRouteEvent({
      request,
      route: THREAD_TITLE_SUGGESTIONS_ROUTE_PATH,
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
    const title = await threadTitleSuggestionService.generateTitle(
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
      route: THREAD_TITLE_SUGGESTIONS_ROUTE_PATH,
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
