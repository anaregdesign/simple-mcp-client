import {
  isInstructionSaveCanceled,
  saveInstructionToClientFile,
} from "~/lib/client/infrastructure/browser/instruction-file-save";
import {
  buildInstructionSuggestedFileName,
  resolveInstructionSourceFileName,
} from "~/lib/client/usecase/workspace/instruction-editor/instruction-format";
import type {
  InstructionPromptHandlerDependencies,
} from "~/lib/client/usecase/workspace/instruction-editor/instruction-prompt-types";

export async function saveInstructionPrompt(
  deps: InstructionPromptHandlerDependencies,
): Promise<void> {
  const saveInstructionFile =
    deps.saveInstructionFile ?? saveInstructionToClientFile;
  const readSaveCanceled =
    deps.isInstructionSaveCanceled ?? isInstructionSaveCanceled;

  if (deps.isArchivedThread(deps.readActiveThreadId())) {
    return;
  }

  if (deps.isSavingInstructionPrompt) {
    return;
  }

  deps.setInstructionSaveError(null);
  deps.setInstructionSaveSuccess(null);

  const agentInstruction = deps.readAgentInstruction();
  if (!agentInstruction.trim()) {
    deps.setInstructionSaveError("Instruction is empty.");
    return;
  }

  deps.setIsSavingInstructionPrompt(true);

  try {
    const sourceFileName = resolveInstructionSourceFileName(
      deps.readLoadedInstructionFileName(),
    );
    const suggestedFileName = buildInstructionSuggestedFileName(
      sourceFileName,
      agentInstruction,
    );
    const saveResult = await saveInstructionFile(
      agentInstruction,
      suggestedFileName,
    );
    deps.setLoadedInstructionFileName(saveResult.fileName);
    deps.setInstructionSaveSuccess(
      saveResult.mode === "picker"
        ? `Saved as ${saveResult.fileName}`
        : `Download started: ${saveResult.fileName}`,
    );
  } catch (saveError) {
    if (readSaveCanceled(saveError)) {
      return;
    }
    deps.logClientError("save_instruction_file_failed", saveError, {
      action: "save_instruction_file",
    });
    deps.setInstructionSaveError(
      saveError instanceof Error
        ? saveError.message
        : "Failed to save instruction prompt.",
    );
  } finally {
    deps.setIsSavingInstructionPrompt(false);
  }
}
