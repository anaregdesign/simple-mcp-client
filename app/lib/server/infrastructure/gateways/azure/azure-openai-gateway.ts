import { OpenAIResponsesModel } from "@openai/agents-openai";
import { getAzureDependencies } from "~/lib/server/infrastructure/azure/dependencies";
import { normalizeAzureOpenAIBaseURL } from "~/lib/server/usecase/azure/azure-openai-url";
import type { AzureOpenAIClient } from "~/lib/server/usecase/azure/azure-openai-service";

export function createAzureOpenAIClient(
  baseUrl: string,
  tenantId: string,
): AzureOpenAIClient {
  return getAzureDependencies().getAzureOpenAIClient(baseUrl, tenantId);
}

export function createAzureResponsesModel(options: {
  baseUrl: string;
  tenantId: string;
  deploymentName: string;
}): OpenAIResponsesModel {
  return new OpenAIResponsesModel(
    createAzureOpenAIClient(options.baseUrl, options.tenantId),
    options.deploymentName,
  );
}

export async function getAzureBearerTokenForScope(
  scope: string,
  tenantId: string,
): Promise<string> {
  return await getAzureDependencies().getAzureBearerToken(scope, tenantId);
}

export { normalizeAzureOpenAIBaseURL };
