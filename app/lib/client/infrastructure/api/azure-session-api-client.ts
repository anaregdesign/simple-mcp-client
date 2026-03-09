import { requestClientApi } from "~/lib/client/infrastructure/api/api-client";
import { readJsonPayload } from "~/lib/client/infrastructure/api/http";

export type AzureActionApiResponse = {
  message?: string;
  error?: string;
};

type AzureSessionApiClientOptions = {
  fetchImpl?: typeof fetch;
};

export class AzureSessionApiClient {
  async startSession(
    tenantIdRaw = "",
    options: AzureSessionApiClientOptions = {},
  ): Promise<AzureActionApiResponse> {
    const tenantId = tenantIdRaw.trim();
    const init: RequestInit = {
      method: "PUT",
    };
    if (tenantId) {
      init.headers = {
        "Content-Type": "application/json",
      };
      init.body = JSON.stringify({
        tenantId,
      });
    }

    const { payload } = await requestClientApi<AzureActionApiResponse>({
      url: "/api/azure/session",
      init,
      readPayload: (response) =>
        readJsonPayload<AzureActionApiResponse>(response, "Azure session"),
      resolveAuthRequired: () => false,
      readErrorMessage: (responsePayload) =>
        typeof responsePayload.error === "string" ? responsePayload.error : null,
      fallbackErrorMessage: "Failed to start Azure login.",
      fetchImpl: options.fetchImpl,
    });

    return payload;
  }

  async endSession(
    options: AzureSessionApiClientOptions = {},
  ): Promise<AzureActionApiResponse> {
    const { payload } = await requestClientApi<AzureActionApiResponse>({
      url: "/api/azure/session",
      init: {
        method: "DELETE",
      },
      readPayload: (response) =>
        readJsonPayload<AzureActionApiResponse>(response, "Azure session"),
      resolveAuthRequired: () => false,
      readErrorMessage: (responsePayload) =>
        typeof responsePayload.error === "string" ? responsePayload.error : null,
      fallbackErrorMessage: "Failed to run Azure logout.",
      fetchImpl: options.fetchImpl,
    });

    return payload;
  }
}

export const azureSessionApiClient = new AzureSessionApiClient();
