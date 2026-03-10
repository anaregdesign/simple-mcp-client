import type {
  InstructionEnhanceComparison,
} from "~/lib/client/usecase/workspace/instruction-editor/instruction-enhance-comparison";
import {
  applyInstructionUnifiedDiffPatch,
  normalizeInstructionDiffPatchResponse,
} from "~/lib/client/usecase/workspace/instruction-editor/instruction-diff-patch";
import {
  validateEnhancedInstructionFormat,
} from "~/lib/client/usecase/workspace/instruction-editor/instruction-format";
import type { InstructionLanguage } from "~/lib/client/usecase/workspace/instruction-editor/view-types";

type ReadInstructionEnhancementResponseOptions = {
  currentInstruction: string;
  responseMessage: string;
  instructionExtension: string;
  instructionLanguage: InstructionLanguage;
};

export function readInstructionEnhancementComparison(
  options: ReadInstructionEnhancementResponseOptions,
): InstructionEnhanceComparison | null {
  const normalizedInstructionPatch =
    normalizeInstructionDiffPatchResponse(options.responseMessage);
  if (!normalizedInstructionPatch) {
    return null;
  }

  const patchApplyResult = applyInstructionUnifiedDiffPatch(
    options.currentInstruction,
    normalizedInstructionPatch,
  );
  if (!patchApplyResult.ok) {
    throw new Error(patchApplyResult.error);
  }

  const normalizedEnhancedInstruction = patchApplyResult.value;
  const formatValidation = validateEnhancedInstructionFormat(
    normalizedEnhancedInstruction,
    options.instructionExtension,
  );
  if (!formatValidation.ok) {
    throw new Error(formatValidation.error);
  }

  if (normalizedEnhancedInstruction === options.currentInstruction) {
    return null;
  }

  return {
    original: options.currentInstruction,
    enhanced: normalizedEnhancedInstruction,
    extension: options.instructionExtension,
    language: options.instructionLanguage,
    diffPatch: normalizedInstructionPatch,
  };
}
