import {
  ClientApiError,
  requestClientApi,
  resolveAuthRequired,
} from "~/lib/client/infrastructure/api/api-client";
import { readJsonPayload } from "~/lib/client/infrastructure/api/http";
import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";

export type ThreadTitleAzureConfigInput = {
  tenantId: string;
  projectName: string;
  baseUrl: string;
  apiVersion: string;
  deploymentName: string;
};

export type ThreadTitleSuggestionRequest = {
  playgroundContent: string;
  instruction: string;
  azureConfig: ThreadTitleAzureConfigInput;
  supportsReasoningEffort: boolean;
  reasoningEffort?: ReasoningEffort;
};

export type ThreadTitleApiResponse = {
  title?: string;
  error?: string;
  errorCode?: "azure_login_required";
  authRequired?: boolean;
};

type ThreadTitleApiClientOptions = {
  onAuthRequired?: () => void;
  fetchImpl?: typeof fetch;
};

const THREAD_TITLE_AUTH_REQUIRED_MESSAGE =
  "Azure login is required. Open Settings and sign in to generate thread titles.";

export class ThreadTitleApiClient {
  async generateTitle(
    request: ThreadTitleSuggestionRequest,
    options: ThreadTitleApiClientOptions = {},
  ): Promise<ThreadTitleApiResponse> {
    const { response, payload } = await requestClientApi<ThreadTitleApiResponse>({
      url: "/api/threads/title-suggestions",
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(request),
      },
      readPayload: (rawResponse) =>
        readJsonPayload<ThreadTitleApiResponse>(
          rawResponse,
          "Thread title suggestions",
        ),
      resolveAuthRequired: (status, responsePayload) =>
        resolveAuthRequired(
          status,
          responsePayload,
          isThreadTitleAuthRequiredPayload,
        ),
      readErrorMessage: (responsePayload) =>
        typeof responsePayload.error === "string" ? responsePayload.error : null,
      fallbackErrorMessage: "Failed to generate thread title.",
      authRequiredMessage: THREAD_TITLE_AUTH_REQUIRED_MESSAGE,
      onAuthRequired: options.onAuthRequired,
      fetchImpl: options.fetchImpl,
    });

    if (typeof payload.error === "string" && payload.error.trim()) {
      const errorMessage = payload.error;
      if (isThreadTitleAuthRequiredPayload(payload)) {
        options.onAuthRequired?.();
        throw new ClientApiError({
          kind: "auth_required",
          status: response.status,
          message: THREAD_TITLE_AUTH_REQUIRED_MESSAGE,
          payload,
        });
      }

      throw new ClientApiError({
        kind: "http_error",
        status: response.status,
        message: errorMessage,
        payload,
      });
    }

    return payload;
  }
}

export const threadTitleApiClient = new ThreadTitleApiClient();

function isThreadTitleAuthRequiredPayload(
  payload: unknown,
): payload is ThreadTitleApiResponse {
  return (
    payload !== null &&
    typeof payload === "object" &&
    "errorCode" in payload &&
    payload.errorCode === "azure_login_required"
  );
}
