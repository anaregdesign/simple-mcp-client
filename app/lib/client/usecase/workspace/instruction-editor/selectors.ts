export type InstructionEditorViewModel = {
  hasInstructionInteraction: boolean;
  canClearAgentInstruction: boolean;
  canSaveAgentInstructionPrompt: boolean;
  canEnhanceAgentInstruction: boolean;
  isEnhancingInstructionForActiveThread: boolean;
};

export function selectInstructionEditorViewModel(options: {
  agentInstruction: string;
  loadedInstructionFileName: string | null;
  instructionFileError: string | null;
  isEnhancingInstruction: boolean;
  instructionEnhancingThreadId: string;
  activeThreadId: string;
}): InstructionEditorViewModel {
  const hasInstructionInteraction =
    options.agentInstruction.trim().length > 0 ||
    options.loadedInstructionFileName !== null ||
    options.instructionFileError !== null;
  const canSaveAgentInstructionPrompt =
    options.agentInstruction.trim().length > 0;
  const canEnhanceAgentInstruction = options.agentInstruction.trim().length > 0;

  return {
    hasInstructionInteraction,
    canClearAgentInstruction: hasInstructionInteraction,
    canSaveAgentInstructionPrompt,
    canEnhanceAgentInstruction,
    isEnhancingInstructionForActiveThread:
      options.isEnhancingInstruction &&
      options.instructionEnhancingThreadId.length > 0 &&
      options.instructionEnhancingThreadId === options.activeThreadId,
  };
}
