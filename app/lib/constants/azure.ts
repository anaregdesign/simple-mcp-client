/**
 * Impact scope:
 * These constants are shared by Azure ARM discovery and Azure OpenAI auth logic.
 * Changing them affects project/deployment discovery and token acquisition behavior.
 */
export const AZURE_COGNITIVE_SERVICES_SCOPE = "https://cognitiveservices.azure.com/.default";
export const AZURE_ARM_SCOPE = "https://management.azure.com/.default";
export const AZURE_GRAPH_SCOPE = "https://graph.microsoft.com/.default";
export const AZURE_SUBSCRIPTIONS_API_VERSION = "2022-12-01";
export const AZURE_TENANTS_API_VERSION = "2022-12-01";
export const AZURE_COGNITIVE_API_VERSION = "2024-10-01";
export const AZURE_OPENAI_DEFAULT_API_VERSION = "v1";
export const AZURE_ACCESS_TOKEN_REFRESH_BUFFER_MS = 30_000;
export const AZURE_MAX_TENANTS = 256;
export const AZURE_MAX_SUBSCRIPTIONS = 64;
export const AZURE_MAX_ACCOUNTS_PER_SUBSCRIPTION = 256;
export const AZURE_MAX_DEPLOYMENTS_PER_ACCOUNT = 256;
export const AZURE_MAX_MODELS_PER_ACCOUNT = 512;
