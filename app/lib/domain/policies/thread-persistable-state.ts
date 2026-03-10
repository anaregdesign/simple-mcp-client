import {
  DEFAULT_AGENT_INSTRUCTION,
  DEFAULT_REASONING_EFFORT,
  DEFAULT_WEB_SEARCH_ENABLED,
} from "~/lib/constants/chat";
import type {
  ThreadEnvironment,
  ThreadInstructionContextToggles,
} from "~/lib/domain/entities/thread";
import type { ChatAzureConfig } from "~/lib/domain/value-objects/chat-azure-config";
import type { ReasoningEffort } from "~/lib/domain/value-objects/reasoning-effort";

export type ThreadPersistableStateInput = {
  messageCount: number;
  skillSelectionCount: number;
  reasoningEffort: ReasoningEffort;
  webSearchEnabled: boolean;
  chatAzureConfig?: ChatAzureConfig | null;
  instructionContent?: string | null;
  instructionContextToggles: ThreadInstructionContextToggles;
  threadEnvironment: ThreadEnvironment;
};

export function hasPersistableThreadState(
  input: ThreadPersistableStateInput,
): boolean {
  if (input.messageCount > 0 || input.skillSelectionCount > 0) {
    return true;
  }

  const normalizedInstruction = input.instructionContent?.trim() ?? "";
  const hasChatAzureConfig = (input.chatAzureConfig ?? null) !== null;
  const hasCustomInstruction =
    normalizedInstruction.length > 0 &&
    normalizedInstruction !== DEFAULT_AGENT_INSTRUCTION;

  return (
    input.reasoningEffort !== DEFAULT_REASONING_EFFORT ||
    input.webSearchEnabled !== DEFAULT_WEB_SEARCH_ENABLED ||
    hasChatAzureConfig ||
    hasCustomInstruction ||
    input.instructionContextToggles.system !== true ||
    Object.keys(input.threadEnvironment).length > 0
  );
}
