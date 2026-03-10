import type {
  InstructionPatchEnhancementRequest,
  InstructionPatchesApiResponse,
} from "~/lib/client/infrastructure/api/instruction-patches-api-client";
import type {
  AzureDeploymentOption,
  AzureProjectOption,
} from "~/lib/client/usecase/workspace/azure-settings/parsers";
import type { InstructionEnhanceComparison } from "~/lib/client/usecase/workspace/types";
import type { MainViewTab, ReasoningEffort } from "~/lib/client/usecase/workspace/view-types";
import type {
  SaveInstructionToClientFileResult,
} from "~/lib/client/usecase/workspace/instruction-editor/instruction-document";

export type InstructionPromptLogOptions = {
  category?: string;
  location?: string;
  action?: string;
  statusCode?: number;
  context?: Record<string, unknown>;
};

export type RefreshInstructionThreadTitleOptions = {
  threadId: string;
  reason: "instruction_update";
  instructionOverride?: string;
};

export type InstructionPromptHandlerDependencies = {
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
