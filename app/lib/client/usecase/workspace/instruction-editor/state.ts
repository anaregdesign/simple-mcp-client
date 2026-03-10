import {
  DEFAULT_AGENT_INSTRUCTION,
} from "~/lib/constants/chat";
import {
  DEFAULT_THREAD_INSTRUCTION_CONTEXT_TOGGLES,
} from "~/lib/contracts/threads/instruction-context";
import {
  cloneThreadInstructionContexts,
} from "~/lib/contracts/threads/state";
import type {
  InstructionEnhanceComparison,
} from "~/lib/client/usecase/workspace/types";

export type InstructionEditorState = {
  agentInstruction: string;
  instructionContextToggles: typeof DEFAULT_THREAD_INSTRUCTION_CONTEXT_TOGGLES;
  loadedInstructionFileName: string | null;
  instructionFileError: string | null;
  instructionSaveError: string | null;
  instructionSaveSuccess: string | null;
  isSavingInstructionPrompt: boolean;
  instructionEnhanceError: string | null;
  instructionEnhanceSuccess: string | null;
  isEnhancingInstruction: boolean;
  instructionEnhancingThreadId: string;
  instructionEnhanceComparison: InstructionEnhanceComparison | null;
};

export function createInitialInstructionEditorState(): InstructionEditorState {
  return {
    agentInstruction: DEFAULT_AGENT_INSTRUCTION,
    instructionContextToggles: cloneThreadInstructionContexts(
      DEFAULT_THREAD_INSTRUCTION_CONTEXT_TOGGLES,
    ),
    loadedInstructionFileName: null,
    instructionFileError: null,
    instructionSaveError: null,
    instructionSaveSuccess: null,
    isSavingInstructionPrompt: false,
    instructionEnhanceError: null,
    instructionEnhanceSuccess: null,
    isEnhancingInstruction: false,
    instructionEnhancingThreadId: "",
    instructionEnhanceComparison: null,
  };
}
