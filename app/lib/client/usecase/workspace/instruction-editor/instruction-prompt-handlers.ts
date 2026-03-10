import { INSTRUCTION_ENHANCE_SYSTEM_PROMPT } from "~/lib/constants/instruction";
import type {
  InstructionPatchEnhancementRequest,
  InstructionPatchesApiResponse,
} from "~/lib/client/infrastructure/api/instruction-patches-api-client";
import type {
  AzureDeploymentOption,
  AzureProjectOption,
} from "~/lib/client/usecase/workspace/azure-settings/parsers";
import { includesAzureDeploymentName } from "~/lib/client/usecase/workspace/azure-settings/selectors";
import {
  applyInstructionUnifiedDiffPatch,
  buildInstructionEnhanceMessage,
  buildInstructionSuggestedFileName,
  detectInstructionLanguage,
  isInstructionSaveCanceled,
  normalizeInstructionDiffPatchResponse,
  resolveInstructionFormatExtension,
  resolveInstructionSourceFileName,
  saveInstructionToClientFile,
  validateEnhancedInstructionFormat,
  type SaveInstructionToClientFileResult,
} from "~/lib/client/usecase/workspace/instruction-editor/instruction-document";
import type { InstructionEnhanceComparison } from "~/lib/client/usecase/workspace/types";
import type { MainViewTab, ReasoningEffort } from "~/lib/client/usecase/workspace/view-types";

type InstructionPromptLogOptions = {
  category?: string;
  location?: string;
  action?: string;
  statusCode?: number;
  context?: Record<string, unknown>;
};

type RefreshInstructionThreadTitleOptions = {
  threadId: string;
  reason: "instruction_update";
  instructionOverride?: string;
};

type InstructionPromptHandlerDependencies = {
  isArchivedThread: (threadIdRaw: string) => boolean;
  readActiveThreadId: () => string;
  readAgentInstruction: () => string;
  readLoadedInstructionFileName: () => string | null;
  readInstructionEnhanceComparison: () => InstructionEnhanceComparison | null;
  isSavingInstructionPrompt: boolean;
  setIsSavingInstructionPrompt: (value: boolean) => void;
  isEnhancingInstruction: boolean;
  setIsEnhancingInstruction: (value: boolean) => void;
  setInstructionEnhancingThreadId: (value: string) => void;
  setLoadedInstructionFileName: (value: string | null) => void;
  setInstructionFileError: (value: string | null) => void;
  setInstructionSaveError: (value: string | null) => void;
  setInstructionSaveSuccess: (value: string | null) => void;
  setInstructionEnhanceError: (value: string | null) => void;
  setInstructionEnhanceSuccess: (value: string | null) => void;
  setInstructionEnhanceComparison: (
    value: InstructionEnhanceComparison | null,
  ) => void;
  setAgentInstruction: (value: string) => void;
  setActiveMainTab: (tab: MainViewTab) => void;
  isChatLocked: boolean;
  readActiveAzureTenantId: () => string;
  readActiveUtilityAzureConnection: () => AzureProjectOption | null;
  readSelectedUtilityAzureDeploymentName: () => string;
  readUtilityAzureDeployments: () => AzureDeploymentOption[];
  isLoadingUtilityAzureDeployments: boolean;
  isUtilityReasoningEffortSupported: boolean;
  readEffectiveUtilityReasoningEffort: () => ReasoningEffort;
  readEffectiveUtilityReasoningEffortOptions: () => ReasoningEffort[];
  handleSelectUtilityProject: (projectId: string) => void;
  handleSelectUtilityDeployment: (deploymentName: string) => void;
  handleAzureUtilityReasoningEffortChange: (value: ReasoningEffort) => void;
  requestInstructionEnhancement: (
    request: InstructionPatchEnhancementRequest,
  ) => Promise<InstructionPatchesApiResponse>;
  saveInstructionFile?: (
    instruction: string,
    suggestedFileName: string,
  ) => Promise<SaveInstructionToClientFileResult>;
  isInstructionSaveCanceled?: (error: unknown) => boolean;
  refreshThreadTitleInBackground: (
    options: RefreshInstructionThreadTitleOptions,
  ) => Promise<void>;
  logClientError: (
    eventName: string,
    error: unknown,
    options?: InstructionPromptLogOptions,
  ) => void;
};

export type InstructionPromptHandlers = {
  handleUtilityProjectChange: (projectId: string) => void;
  handleUtilityDeploymentChange: (nextDeploymentNameRaw: string) => void;
  handleUtilityReasoningEffortChange: (nextValue: ReasoningEffort) => void;
  handleSaveInstructionPrompt: () => Promise<void>;
  handleEnhanceInstruction: () => Promise<void>;
  handleAdoptEnhancedInstruction: () => void;
  handleAdoptOriginalInstruction: () => void;
};

export function createInstructionPromptHandlers(
  deps: InstructionPromptHandlerDependencies,
): InstructionPromptHandlers {
  const saveInstructionFile =
    deps.saveInstructionFile ?? saveInstructionToClientFile;
  const readSaveCanceled =
    deps.isInstructionSaveCanceled ?? isInstructionSaveCanceled;

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
    },

    async handleEnhanceInstruction() {
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
        const request: InstructionPatchEnhancementRequest = {
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
        };
        if (deps.isUtilityReasoningEffortSupported) {
          request.reasoningEffort = deps.readEffectiveUtilityReasoningEffort();
        }

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
    },

    handleAdoptEnhancedInstruction() {
      if (deps.isArchivedThread(deps.readActiveThreadId())) {
        return;
      }

      const instructionEnhanceComparison =
        deps.readInstructionEnhanceComparison();
      if (!instructionEnhanceComparison) {
        return;
      }

      const enhancedInstruction = instructionEnhanceComparison.enhanced;
      const currentThreadId = deps.readActiveThreadId().trim();
      deps.setAgentInstruction(enhancedInstruction);
      deps.setInstructionEnhanceComparison(null);
      deps.setInstructionEnhanceError(null);
      deps.setInstructionSaveError(null);
      deps.setInstructionSaveSuccess(null);
      deps.setInstructionEnhanceSuccess("Enhanced instruction applied.");
      if (currentThreadId) {
        void deps.refreshThreadTitleInBackground({
          threadId: currentThreadId,
          reason: "instruction_update",
          instructionOverride: enhancedInstruction,
        });
      }
    },

    handleAdoptOriginalInstruction() {
      if (deps.isArchivedThread(deps.readActiveThreadId())) {
        return;
      }

      const instructionEnhanceComparison =
        deps.readInstructionEnhanceComparison();
      if (!instructionEnhanceComparison) {
        return;
      }

      const originalInstruction = instructionEnhanceComparison.original;
      const currentThreadId = deps.readActiveThreadId().trim();
      deps.setAgentInstruction(originalInstruction);
      deps.setInstructionEnhanceComparison(null);
      deps.setInstructionEnhanceError(null);
      deps.setInstructionSaveError(null);
      deps.setInstructionSaveSuccess(null);
      deps.setInstructionEnhanceSuccess("Kept original instruction.");
      if (currentThreadId) {
        void deps.refreshThreadTitleInBackground({
          threadId: currentThreadId,
          reason: "instruction_update",
          instructionOverride: originalInstruction,
        });
      }
    },
  };
}
