/**
 * Client controller runtime module.
 */
import type { InstructionLanguage } from "~/lib/client/usecase/workspace/view-types";

/**
 * Diff-review payload for instruction enhancement.
 * The controller keeps both variants so the user can choose which one to adopt.
 */
export type InstructionEnhanceComparison = {
  original: string;
  enhanced: string;
  extension: string;
  language: InstructionLanguage;
  diffPatch: string;
};

/**
 * Per-thread request lifecycle state for chat streaming UI.
 */
export type ThreadRequestState = {
  isSending: boolean;
  sendProgressMessages: string[];
  activeTurnId: string | null;
  lastErrorTurnId: string | null;
  error: string | null;
};
