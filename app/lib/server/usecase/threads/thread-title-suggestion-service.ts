import { THREAD_AUTO_TITLE_SYSTEM_PROMPT } from "~/lib/constants/chat";
import type { ThreadTitleGenerationGateway } from "~/lib/domain/repositories/thread-title-generation-gateway";
import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";
import { normalizeGeneratedThreadTitle } from "~/lib/domain/value-objects/thread-name";
import { buildThreadAutoTitleRequestMessage } from "~/lib/server/usecase/threads/thread-title-prompt";

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
    const normalized = normalizeGeneratedThreadTitle(finalOutput.title);
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
      const normalizedFromJson = normalizeGeneratedThreadTitle(parsed.title);
      if (normalizedFromJson) {
        return normalizedFromJson;
      }
    }

    const normalized = normalizeGeneratedThreadTitle(trimmed);
    if (normalized) {
      return normalized;
    }
    throw new Error("Thread title response is empty.");
  }

  throw new Error("Thread title response is not valid.");
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
