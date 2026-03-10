import { includesAzureDeploymentName } from "~/lib/client/usecase/workspace/azure-settings/selectors";
import {
  buildInstructionEnhancementRequest,
} from "~/lib/client/usecase/workspace/instruction-editor/instruction-enhancement-request";
import {
  readInstructionEnhancementComparison,
} from "~/lib/client/usecase/workspace/instruction-editor/instruction-enhancement-response";
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

  const enhancementDraft = buildInstructionEnhancementRequest({
    currentInstruction,
    loadedInstructionFileName: deps.readLoadedInstructionFileName(),
    activeAzureTenantId: deps.readActiveAzureTenantId(),
    utilityAzureConnection: activeUtilityAzureConnection,
    deploymentName,
    isUtilityReasoningEffortSupported:
      deps.isUtilityReasoningEffortSupported,
    effectiveUtilityReasoningEffort:
      deps.readEffectiveUtilityReasoningEffort(),
  });

  deps.setInstructionEnhancingThreadId(enhanceThreadId);
  deps.setIsEnhancingInstruction(true);

  try {
    const payload = await deps.requestInstructionEnhancement(
      enhancementDraft.request,
    );
    if (typeof payload.error === "string" && payload.error.trim()) {
      throw new Error(payload.error);
    }

    const comparison = readInstructionEnhancementComparison({
      currentInstruction,
      responseMessage: typeof payload.message === "string" ? payload.message : "",
      instructionExtension: enhancementDraft.instructionExtension,
      instructionLanguage: enhancementDraft.instructionLanguage,
    });
    if (!comparison) {
      deps.setInstructionEnhanceSuccess("No changes were suggested.");
      return;
    }

    deps.setInstructionEnhanceComparison(comparison);
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
