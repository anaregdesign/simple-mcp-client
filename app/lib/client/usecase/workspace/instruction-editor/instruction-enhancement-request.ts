import { INSTRUCTION_ENHANCE_SYSTEM_PROMPT } from "~/lib/constants/instruction";
import type {
  InstructionPatchEnhancementRequest,
} from "~/lib/client/infrastructure/api/instruction-patches-api-client";
import {
  buildInstructionEnhanceMessage,
  detectInstructionLanguage,
  resolveInstructionFormatExtension,
  resolveInstructionSourceFileName,
} from "~/lib/client/usecase/workspace/instruction-editor/instruction-format";
import type { ReasoningEffort } from "~/lib/client/usecase/workspace/view-types";

type UtilityAzureConnection = {
  projectName: string;
  baseUrl: string;
  apiVersion: string;
};

export type BuildInstructionEnhancementRequestOptions = {
  currentInstruction: string;
  loadedInstructionFileName: string | null;
  activeAzureTenantId: string;
  utilityAzureConnection: UtilityAzureConnection;
  deploymentName: string;
  isUtilityReasoningEffortSupported: boolean;
  effectiveUtilityReasoningEffort: ReasoningEffort;
};

export type InstructionEnhancementRequestDraft = {
  request: InstructionPatchEnhancementRequest;
  instructionExtension: string;
  instructionLanguage: ReturnType<typeof detectInstructionLanguage>;
};

export function buildInstructionEnhancementRequest(
  options: BuildInstructionEnhancementRequestOptions,
): InstructionEnhancementRequestDraft {
  const sourceFileName = resolveInstructionSourceFileName(
    options.loadedInstructionFileName,
  );
  const instructionExtension = resolveInstructionFormatExtension(
    sourceFileName,
    options.currentInstruction,
  );
  const instructionLanguage = detectInstructionLanguage(
    options.currentInstruction,
  );
  const enhanceRequestMessage = buildInstructionEnhanceMessage({
    instruction: options.currentInstruction,
    extension: instructionExtension,
    language: instructionLanguage,
  });

  return {
    request: {
      message: enhanceRequestMessage,
      azureConfig: {
        tenantId: options.activeAzureTenantId,
        projectName: options.utilityAzureConnection.projectName,
        baseUrl: options.utilityAzureConnection.baseUrl,
        apiVersion: options.utilityAzureConnection.apiVersion,
        deploymentName: options.deploymentName,
      },
      supportsReasoningEffort: options.isUtilityReasoningEffortSupported,
      enhanceAgentInstruction: INSTRUCTION_ENHANCE_SYSTEM_PROMPT,
      ...(options.isUtilityReasoningEffortSupported
        ? {
            reasoningEffort: options.effectiveUtilityReasoningEffort,
          }
        : {}),
    },
    instructionExtension,
    instructionLanguage,
  };
}
