import type {
  InstructionPromptHandlerDependencies,
} from "~/lib/client/usecase/workspace/instruction-editor/instruction-prompt-types";

function adoptInstruction(
  deps: InstructionPromptHandlerDependencies,
  mode: "enhanced" | "original",
): void {
  if (deps.isArchivedThread(deps.readActiveThreadId())) {
    return;
  }

  const instructionEnhanceComparison =
    deps.readInstructionEnhanceComparison();
  if (!instructionEnhanceComparison) {
    return;
  }

  const nextInstruction =
    mode === "enhanced"
      ? instructionEnhanceComparison.enhanced
      : instructionEnhanceComparison.original;
  const successMessage =
    mode === "enhanced"
      ? "Enhanced instruction applied."
      : "Kept original instruction.";
  const currentThreadId = deps.readActiveThreadId().trim();
  deps.setAgentInstruction(nextInstruction);
  deps.setInstructionEnhanceComparison(null);
  deps.setInstructionEnhanceError(null);
  deps.setInstructionSaveError(null);
  deps.setInstructionSaveSuccess(null);
  deps.setInstructionEnhanceSuccess(successMessage);
  if (currentThreadId) {
    void deps.refreshThreadTitleInBackground({
      threadId: currentThreadId,
      reason: "instruction_update",
      instructionOverride: nextInstruction,
    });
  }
}

export function adoptEnhancedInstruction(
  deps: InstructionPromptHandlerDependencies,
): void {
  adoptInstruction(deps, "enhanced");
}

export function adoptOriginalInstruction(
  deps: InstructionPromptHandlerDependencies,
): void {
  adoptInstruction(deps, "original");
}
