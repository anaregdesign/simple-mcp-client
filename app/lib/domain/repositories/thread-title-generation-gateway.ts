import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";

export type ThreadTitleGenerationRequest = {
  prompt: string;
  systemPrompt: string;
  tenantId: string;
  baseUrl: string;
  deploymentName: string;
  reasoningEffort: ReasoningEffort | null;
};

export interface ThreadTitleGenerationGateway {
  generateTitle(request: ThreadTitleGenerationRequest): Promise<unknown>;
}
