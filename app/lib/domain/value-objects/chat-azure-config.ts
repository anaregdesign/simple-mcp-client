export type ChatAzureConfig = {
  tenantId: string;
  projectId: string;
  projectName: string;
  baseUrl: string;
  apiVersion: string;
  deploymentName: string;
};

export function readChatAzureConfigFromUnknown(
  value: unknown,
): ChatAzureConfig | null {
  if (!isRecord(value)) {
    return null;
  }

  const tenantId = readRequiredString(value.tenantId);
  const projectId = readRequiredString(value.projectId);
  const projectName = readRequiredString(value.projectName);
  const baseUrl = normalizeAzureOpenAIBaseURL(readRequiredString(value.baseUrl));
  const apiVersion = readRequiredString(value.apiVersion);
  const deploymentName = readRequiredString(value.deploymentName);
  if (
    !tenantId ||
    !projectId ||
    !projectName ||
    !baseUrl ||
    !apiVersion ||
    !deploymentName
  ) {
    return null;
  }

  return {
    tenantId,
    projectId,
    projectName,
    baseUrl,
    apiVersion,
    deploymentName,
  };
}

export function cloneChatAzureConfig(
  value: ChatAzureConfig | null | undefined,
): ChatAzureConfig | null {
  return value ? { ...value } : null;
}

export function normalizeAzureOpenAIBaseURL(rawValue: string): string {
  const trimmed = rawValue.trim().replace(/\/+$/, "");
  if (!trimmed) {
    return "";
  }

  if (/\/openai\/v1$/i.test(trimmed)) {
    return `${trimmed}/`;
  }

  return `${trimmed}/openai/v1/`;
}

function readRequiredString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}
