import {
  requestClientApi,
  resolveAuthRequired,
} from "~/lib/client/infrastructure/api/api-client";
import { readJsonPayload } from "~/lib/client/infrastructure/api/http";
import type {
  AzureDeploymentResource,
  AzurePrincipalProfileResource,
  AzureProjectResource,
  AzureTenantResource,
} from "~/lib/contracts/api/azure";

export type AzureProjectsApiResponse = {
  projects?: AzureProjectResource[];
  deployments?: AzureDeploymentResource[];
  tenants?: AzureTenantResource[];
  principal?: AzurePrincipalProfileResource | null;
  tenantId?: string;
  principalId?: string;
  authRequired?: boolean;
  error?: string;
  code?: string;
};

type AzureProjectsApiClientOptions = {
  onAuthRequired?: () => void;
  fetchImpl?: typeof fetch;
};

export class AzureProjectsApiClient {
  async loadProjects(
    options: AzureProjectsApiClientOptions & {
      preferredTenantId?: string;
    } = {},
  ): Promise<AzureProjectsApiResponse> {
    const tenantId = options.preferredTenantId?.trim() ?? "";
    const requestUrl = tenantId
      ? `/api/azure/projects?tenantId=${encodeURIComponent(tenantId)}`
      : "/api/azure/projects";
    const { payload } = await requestClientApi<AzureProjectsApiResponse>({
      url: requestUrl,
      init: {
        method: "GET",
      },
      readPayload: (response) =>
        readJsonPayload<AzureProjectsApiResponse>(response, "Azure projects"),
      resolveAuthRequired: (status, responsePayload) =>
        resolveAuthRequired(status, responsePayload),
      readErrorMessage: (responsePayload) =>
        typeof responsePayload.error === "string" ? responsePayload.error : null,
      fallbackErrorMessage: "Failed to load Azure projects.",
      authRequiredMessage:
        "Azure login is required. Open Settings and sign in to load threads.",
      onAuthRequired: options.onAuthRequired,
      fetchImpl: options.fetchImpl,
    });

    return payload;
  }

  async loadDeployments(
    projectId: string,
    options: AzureProjectsApiClientOptions = {},
  ): Promise<AzureProjectsApiResponse> {
    const { payload } = await requestClientApi<AzureProjectsApiResponse>({
      url: `/api/azure/projects/${encodeURIComponent(projectId)}/deployments`,
      init: {
        method: "GET",
      },
      readPayload: (response) =>
        readJsonPayload<AzureProjectsApiResponse>(
          response,
          "Azure deployments",
        ),
      resolveAuthRequired: (status, responsePayload) =>
        resolveAuthRequired(status, responsePayload),
      readErrorMessage: (responsePayload) =>
        typeof responsePayload.error === "string" ? responsePayload.error : null,
      fallbackErrorMessage:
        "Failed to load deployments for the selected project.",
      authRequiredMessage:
        "Azure login is required. Open Settings and sign in to load threads.",
      onAuthRequired: options.onAuthRequired,
      fetchImpl: options.fetchImpl,
    });

    return payload;
  }
}

export const azureProjectsApiClient = new AzureProjectsApiClient();
