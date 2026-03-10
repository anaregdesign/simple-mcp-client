import {
  adoptEnhancedInstruction,
  adoptOriginalInstruction,
  enhanceInstruction,
  saveInstructionPrompt,
} from "~/lib/client/usecase/workspace/instruction-editor/instruction-prompt-operations";
import type {
  InstructionPromptHandlerDependencies,
  InstructionPromptHandlers,
} from "~/lib/client/usecase/workspace/instruction-editor/instruction-prompt-types";

export function createInstructionPromptHandlers(
  deps: InstructionPromptHandlerDependencies,
): InstructionPromptHandlers {
  return {
    handleUtilityProjectChange(projectId) {
      deps.handleSelectUtilityProject(projectId);
      deps.setInstructionEnhanceError(null);
    },

    handleUtilityDeploymentChange(nextDeploymentNameRaw) {
      deps.handleSelectUtilityDeployment(nextDeploymentNameRaw.trim());
      deps.setInstructionEnhanceError(null);
    },

    handleUtilityReasoningEffortChange(nextValue) {
      if (!deps.isUtilityReasoningEffortSupported) {
        return;
      }
      if (!deps.readEffectiveUtilityReasoningEffortOptions().includes(nextValue)) {
        return;
      }

      deps.handleAzureUtilityReasoningEffortChange(nextValue);
      deps.setInstructionEnhanceError(null);
    },

    async handleSaveInstructionPrompt() {
      await saveInstructionPrompt(deps);
    },

    async handleEnhanceInstruction() {
      await enhanceInstruction(deps);
    },

    handleAdoptEnhancedInstruction() {
      adoptEnhancedInstruction(deps);
    },

    handleAdoptOriginalInstruction() {
      adoptOriginalInstruction(deps);
    },
  };
}
