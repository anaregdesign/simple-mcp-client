import {
  requestClientApi,
  resolveAuthRequired,
} from "~/lib/client/infrastructure/api/api-client";
import { readJsonPayload } from "~/lib/client/infrastructure/api/http";

export type AzureSelectionApiResponse = {
  selection?: unknown;
  error?: string;
};

export type AzureSelectionUpdatePayload =
  | {
      target: "playground";
      projectId: string;
      deploymentName: string;
      theme?: string | null;
    }
  | {
      target: "utility";
      projectId: string;
      deploymentName: string;
      reasoningEffort: string;
      theme?: string | null;
    }
  | {
      theme: string;
    };

type AzureSelectionApiClientOptions = {
  onAuthRequired?: () => void;
  fetchImpl?: typeof fetch;
};

export class AzureSelectionApiClient {
  async loadSelection(
    options: AzureSelectionApiClientOptions = {},
  ): Promise<AzureSelectionApiResponse> {
    const { payload } = await requestClientApi<AzureSelectionApiResponse>({
      url: "/api/azure/selection",
      init: {
        method: "GET",
      },
      readPayload: (response) =>
        readJsonPayload<AzureSelectionApiResponse>(
          response,
          "Azure selection",
        ),
      resolveAuthRequired: (status, responsePayload) =>
        resolveAuthRequired(status, responsePayload),
      readErrorMessage: (responsePayload) =>
        typeof responsePayload.error === "string" ? responsePayload.error : null,
      fallbackErrorMessage: "Failed to load Azure selection.",
      authRequiredMessage:
        "Azure login is required. Open Settings and sign in to load Azure preferences.",
      onAuthRequired: options.onAuthRequired,
      fetchImpl: options.fetchImpl,
    });

    return payload;
  }

  async saveSelection(
    payload: AzureSelectionUpdatePayload,
    options: AzureSelectionApiClientOptions = {},
  ): Promise<AzureSelectionApiResponse> {
    const { payload: responsePayload } =
      await requestClientApi<AzureSelectionApiResponse>({
        url: "/api/azure/selection",
        init: {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
        readPayload: (response) =>
          readJsonPayload<AzureSelectionApiResponse>(
            response,
            "Azure selection",
          ),
        resolveAuthRequired: (status, rawPayload) =>
          resolveAuthRequired(status, rawPayload),
        readErrorMessage: (rawPayload) =>
          typeof rawPayload.error === "string" ? rawPayload.error : null,
        fallbackErrorMessage: "Failed to save Azure selection.",
        authRequiredMessage:
          "Azure login is required. Open Settings and sign in to save Azure preferences.",
        onAuthRequired: options.onAuthRequired,
        fetchImpl: options.fetchImpl,
      });

    return responsePayload;
  }
}

export const azureSelectionApiClient = new AzureSelectionApiClient();
