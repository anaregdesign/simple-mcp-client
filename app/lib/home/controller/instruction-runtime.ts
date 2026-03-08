/**
 * Home controller instruction runtime helpers.
 */

export type InstructionRuntimeUiState = {
  hasInstructionInteraction: boolean;
  canSaveAgentInstructionPrompt: boolean;
  canEnhanceAgentInstruction: boolean;
};

export function deriveInstructionRuntimeUiState(options: {
  agentInstruction: string;
  loadedInstructionFileName: string | null;
  instructionFileError: string | null;
}): InstructionRuntimeUiState {
  const hasInstructionInteraction =
    options.agentInstruction.trim().length > 0 ||
    options.loadedInstructionFileName !== null ||
    options.instructionFileError !== null;
  const canSaveAgentInstructionPrompt = options.agentInstruction.trim().length > 0;
  const canEnhanceAgentInstruction = options.agentInstruction.trim().length > 0;

  return {
    hasInstructionInteraction,
    canSaveAgentInstructionPrompt,
    canEnhanceAgentInstruction,
  };
}
