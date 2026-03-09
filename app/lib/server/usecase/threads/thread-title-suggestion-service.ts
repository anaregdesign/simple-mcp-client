import { THREAD_AUTO_TITLE_SYSTEM_PROMPT } from "~/lib/constants/chat";
import { buildThreadAutoTitleRequestMessage, normalizeThreadAutoTitle } from "~/lib/contracts/threads/title";
import type { ThreadTitleGenerationGateway } from "~/lib/domain/repositories/thread-title-generation-gateway";
import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";

export type ResolvedThreadTitleAzureConfig = {
  tenantId: string;
  projectName: string;
  baseUrl: string;
  apiVersion: string;
  deploymentName: string;
};

export type ThreadTitleSuggestionRequest = {
  playgroundContent: string;
  instruction: string;
  azureConfig: ResolvedThreadTitleAzureConfig;
  reasoningEffort: ReasoningEffort | null;
};

type UpstreamErrorPayload = {
  code: string;
  error: string;
  errorCode?: "azure_login_required";
};

export class ThreadTitleSuggestionService {
  constructor(private readonly gateway: ThreadTitleGenerationGateway) {}

  async generateTitle(request: ThreadTitleSuggestionRequest): Promise<string> {
    const prompt = buildThreadAutoTitleRequestMessage({
      playgroundContent: request.playgroundContent,
      instruction: request.instruction,
    });

    const output = await this.gateway.generateTitle({
      prompt,
      systemPrompt: THREAD_AUTO_TITLE_SYSTEM_PROMPT,
      tenantId: request.azureConfig.tenantId,
      baseUrl: request.azureConfig.baseUrl,
      deploymentName: request.azureConfig.deploymentName,
      reasoningEffort: request.reasoningEffort,
    });

    return extractThreadAutoTitle(output);
  }
}

export function createThreadTitleSuggestionService(
  gateway: ThreadTitleGenerationGateway,
): ThreadTitleSuggestionService {
  return new ThreadTitleSuggestionService(gateway);
}

export function extractThreadAutoTitle(finalOutput: unknown): string {
  if (isRecord(finalOutput) && typeof finalOutput.title === "string") {
    const normalized = normalizeThreadAutoTitle(finalOutput.title);
    if (normalized) {
      return normalized;
    }
    throw new Error("Thread title response is empty.");
  }

  if (typeof finalOutput === "string") {
    const trimmed = finalOutput.trim();
    if (!trimmed) {
      throw new Error("Thread title response is empty.");
    }

    const parsed = parseJson(trimmed);
    if (isRecord(parsed) && typeof parsed.title === "string") {
      const normalizedFromJson = normalizeThreadAutoTitle(parsed.title);
      if (normalizedFromJson) {
        return normalizedFromJson;
      }
    }

    const normalized = normalizeThreadAutoTitle(trimmed);
    if (normalized) {
      return normalized;
    }
    throw new Error("Thread title response is empty.");
  }

  throw new Error("Thread title response is not valid.");
}

export function buildThreadTitleUpstreamError(
  error: unknown,
  deploymentName: string,
): {
  payload: UpstreamErrorPayload;
  status: number;
} {
  if (isAzureCredentialError(error)) {
    return {
      payload: {
        code: "auth_required",
        error:
          'Azure authentication failed. Click "Azure Login", complete sign-in, and try again.',
        errorCode: "azure_login_required",
      },
      status: 401,
    };
  }

  const message = buildUpstreamErrorMessage(error, deploymentName);
  return {
    payload: { code: "upstream_service_error", error: message },
    status: 502,
  };
}

function buildUpstreamErrorMessage(
  error: unknown,
  deploymentName: string,
): string {
  if (!(error instanceof Error)) {
    return "Could not connect to Azure OpenAI.";
  }

  if (error.message.includes("Resource not found")) {
    return `${error.message} Check Azure base URL and deployment name (${deploymentName}).`;
  }
  if (error.message.includes("Unavailable model")) {
    return `${error.message} Check the selected deployment name (${deploymentName}).`;
  }
  if (error.message.includes("Model behavior error")) {
    return `${error.message} Verify your model/deployment supports utility workflows.`;
  }

  return error.message;
}

function isAzureCredentialError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return [
    "defaultazurecredential",
    "interactivebrowsercredential",
    "authenticationrequirederror",
    "automatic authentication has been disabled",
    "chainedtokencredential",
    "credentialunavailableerror",
    "managedidentitycredential",
    "azure credential failed",
    "azure credential returned tenant",
    "requested tenant",
    "token without tid claim",
  ].some((pattern) => message.includes(pattern));
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
