import { INSTRUCTION_ENHANCE_SYSTEM_PROMPT } from "~/lib/constants/instruction";
import { includesAzureDeploymentName } from "~/lib/client/usecase/workspace/azure-settings/selectors";
import {
  applyInstructionUnifiedDiffPatch,
  normalizeInstructionDiffPatchResponse,
} from "~/lib/client/usecase/workspace/instruction-editor/instruction-diff-patch";
import {
  buildInstructionEnhanceMessage,
  detectInstructionLanguage,
  resolveInstructionFormatExtension,
  resolveInstructionSourceFileName,
  validateEnhancedInstructionFormat,
} from "~/lib/client/usecase/workspace/instruction-editor/instruction-format";
import type {
  InstructionPromptHandlerDependencies,
} from "~/lib/client/usecase/workspace/instruction-editor/instruction-prompt-types";

export async function enhanceInstruction(
  deps: InstructionPromptHandlerDependencies,
): Promise<void> {
  const enhanceThreadId = deps.readActiveThreadId().trim();
  if (!enhanceThreadId || deps.isArchivedThread(enhanceThreadId)) {
    return;
  }

  if (deps.isEnhancingInstruction) {
    return;
  }

  deps.setInstructionEnhanceError(null);
  deps.setInstructionEnhanceSuccess(null);
  deps.setInstructionEnhanceComparison(null);

  const currentInstruction = deps.readAgentInstruction().trim();
  if (!currentInstruction) {
    deps.setInstructionEnhanceError("Instruction is empty.");
    return;
  }

  if (deps.isChatLocked) {
    deps.setActiveMainTab("settings");
    deps.setInstructionEnhanceError(
      "Playground is unavailable while logged out. Open Azure Connection and sign in first.",
    );
    return;
  }

  const activeUtilityAzureConnection = deps.readActiveUtilityAzureConnection();
  if (!activeUtilityAzureConnection) {
    deps.setInstructionEnhanceError("No Utility project is selected.");
    return;
  }

  const deploymentName = deps.readSelectedUtilityAzureDeploymentName().trim();
  if (deps.isLoadingUtilityAzureDeployments) {
    deps.setInstructionEnhanceError(
      "Utility deployment list is loading. Please wait.",
    );
    return;
  }

  const utilityAzureDeployments = deps.readUtilityAzureDeployments();
  if (
    !deploymentName ||
    !includesAzureDeploymentName(utilityAzureDeployments, deploymentName)
  ) {
    deps.setInstructionEnhanceError(
      "Select a Utility deployment before enhancing.",
    );
    return;
  }

  const sourceFileName = resolveInstructionSourceFileName(
    deps.readLoadedInstructionFileName(),
  );
  const instructionExtension = resolveInstructionFormatExtension(
    sourceFileName,
    currentInstruction,
  );
  const instructionLanguage = detectInstructionLanguage(currentInstruction);
  const enhanceRequestMessage = buildInstructionEnhanceMessage({
    instruction: currentInstruction,
    extension: instructionExtension,
    language: instructionLanguage,
  });

  deps.setInstructionEnhancingThreadId(enhanceThreadId);
  deps.setIsEnhancingInstruction(true);

  try {
    const request = {
      message: enhanceRequestMessage,
      azureConfig: {
        tenantId: deps.readActiveAzureTenantId(),
        projectName: activeUtilityAzureConnection.projectName,
        baseUrl: activeUtilityAzureConnection.baseUrl,
        apiVersion: activeUtilityAzureConnection.apiVersion,
        deploymentName,
      },
      supportsReasoningEffort: deps.isUtilityReasoningEffortSupported,
      enhanceAgentInstruction: INSTRUCTION_ENHANCE_SYSTEM_PROMPT,
      ...(deps.isUtilityReasoningEffortSupported
        ? {
            reasoningEffort: deps.readEffectiveUtilityReasoningEffort(),
          }
        : {}),
    };

    const payload = await deps.requestInstructionEnhancement(request);
    if (typeof payload.error === "string" && payload.error.trim()) {
      throw new Error(payload.error);
    }

    const rawInstructionPatch =
      typeof payload.message === "string" ? payload.message : "";
    const normalizedInstructionPatch =
      normalizeInstructionDiffPatchResponse(rawInstructionPatch);
    if (!normalizedInstructionPatch) {
      deps.setInstructionEnhanceSuccess("No changes were suggested.");
      return;
    }

    const patchApplyResult = applyInstructionUnifiedDiffPatch(
      currentInstruction,
      normalizedInstructionPatch,
    );
    if (!patchApplyResult.ok) {
      throw new Error(patchApplyResult.error);
    }

    const normalizedEnhancedInstruction = patchApplyResult.value;
    const formatValidation = validateEnhancedInstructionFormat(
      normalizedEnhancedInstruction,
      instructionExtension,
    );
    if (!formatValidation.ok) {
      throw new Error(formatValidation.error);
    }

    if (normalizedEnhancedInstruction === currentInstruction) {
      deps.setInstructionEnhanceSuccess("No changes were suggested.");
      return;
    }

    deps.setInstructionEnhanceComparison({
      original: currentInstruction,
      enhanced: normalizedEnhancedInstruction,
      extension: instructionExtension,
      language: instructionLanguage,
      diffPatch: normalizedInstructionPatch,
    });
    deps.setInstructionFileError(null);
    deps.setInstructionSaveError(null);
    deps.setInstructionSaveSuccess(null);
    deps.setInstructionEnhanceSuccess(
      "Review the diff and choose which version to adopt.",
    );
  } catch (enhanceError) {
    deps.logClientError("enhance_instruction_failed", enhanceError, {
      action: "enhance_instruction",
    });
    deps.setInstructionEnhanceError(
      enhanceError instanceof Error
        ? enhanceError.message
        : "Failed to enhance instruction.",
    );
  } finally {
    deps.setIsEnhancingInstruction(false);
    deps.setInstructionEnhancingThreadId("");
  }
}
