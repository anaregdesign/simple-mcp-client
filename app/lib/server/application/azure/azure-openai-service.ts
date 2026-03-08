/**
 * Azure OpenAI application helper module.
 */
import { OpenAIResponsesModel } from "@openai/agents-openai";
import {
  getAzureDependencies,
  normalizeAzureOpenAIBaseURL as normalizeAzureOpenAIBaseUrlInternal,
  type AzureDependencies,
} from "~/lib/server/infrastructure/azure/dependencies";

export type AzureOpenAIClient = ReturnType<AzureDependencies["getAzureOpenAIClient"]>;

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

export function normalizeAzureOpenAIBaseURL(rawValue: string): string {
  return normalizeAzureOpenAIBaseUrlInternal(rawValue);
}
