import type { ChangeEvent } from "react";
import {
  openClientFileInputPicker,
} from "~/lib/client/infrastructure/browser/file-input-open";
import {
  INSTRUCTION_ALLOWED_EXTENSIONS,
  INSTRUCTION_MAX_FILE_SIZE_BYTES,
  INSTRUCTION_MAX_FILE_SIZE_LABEL,
} from "~/lib/constants/instruction";
import type {
  InstructionEnhanceComparison,
} from "~/lib/client/usecase/workspace/instruction-editor/instruction-enhance-comparison";
import type {
  ThreadInstructionContextToggles,
  ThreadInstructionContextToggleKey,
} from "~/lib/domain/value-objects/thread-instruction-context";

type InstructionEditingLogOptions = {
  category?: string;
  location?: string;
  action?: string;
  statusCode?: number;
  context?: Record<string, unknown>;
};

type InstructionEditingHandlerDependencies = {
  isArchivedThread: (threadIdRaw: string) => boolean;
  readActiveThreadId: () => string;
  readInstructionFileInput: () => HTMLInputElement | null;
  setInstructionContextToggles: (
    updater: (
      current: ThreadInstructionContextToggles,
    ) => ThreadInstructionContextToggles,
  ) => void;
  setAgentInstruction: (value: string) => void;
  setLoadedInstructionFileName: (value: string | null) => void;
  setInstructionFileError: (value: string | null) => void;
  setInstructionSaveError: (value: string | null) => void;
  setInstructionSaveSuccess: (value: string | null) => void;
  setInstructionEnhanceError: (value: string | null) => void;
  setInstructionEnhanceSuccess: (value: string | null) => void;
  setInstructionEnhanceComparison: (
    value: InstructionEnhanceComparison | null,
  ) => void;
  logClientError: (
    eventName: string,
    error: unknown,
    options?: InstructionEditingLogOptions,
  ) => void;
  openInstructionFilePicker?: (input: HTMLInputElement | null) => boolean;
};

export type InstructionEditingHandlers = {
  handleInstructionContextToggleChange: (
    toggleKey: ThreadInstructionContextToggleKey,
    nextValue: boolean,
  ) => void;
  handleAgentInstructionChange: (value: string) => void;
  handleOpenInstructionFilePicker: () => void;
  handleClearInstruction: () => void;
  handleInstructionFileChange: (
    event: ChangeEvent<HTMLInputElement>,
  ) => Promise<void>;
};

function readFileExtension(fileName: string): string {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

export function createInstructionEditingHandlers(
  deps: InstructionEditingHandlerDependencies,
): InstructionEditingHandlers {
  const resetInstructionMutationStatus = () => {
    deps.setInstructionSaveError(null);
    deps.setInstructionSaveSuccess(null);
    deps.setInstructionEnhanceError(null);
    deps.setInstructionEnhanceSuccess(null);
    deps.setInstructionEnhanceComparison(null);
  };

  return {
    handleInstructionContextToggleChange(toggleKey, nextValue) {
      if (deps.isArchivedThread(deps.readActiveThreadId())) {
        return;
      }

      deps.setInstructionContextToggles((current) => ({
        ...current,
        [toggleKey]: nextValue,
      }));
      resetInstructionMutationStatus();
    },

    handleAgentInstructionChange(value: string) {
      if (deps.isArchivedThread(deps.readActiveThreadId())) {
        return;
      }

      deps.setAgentInstruction(value);
      resetInstructionMutationStatus();
    },

    handleOpenInstructionFilePicker() {
      if (deps.isArchivedThread(deps.readActiveThreadId())) {
        return;
      }

      deps.setInstructionFileError(null);
      const didOpen = (
        deps.openInstructionFilePicker ?? openClientFileInputPicker
      )(deps.readInstructionFileInput());
      if (!didOpen) {
        deps.setInstructionFileError(
          "Instruction file picker is unavailable right now.",
        );
      }
    },

    handleClearInstruction() {
      if (deps.isArchivedThread(deps.readActiveThreadId())) {
        return;
      }

      deps.setAgentInstruction("");
      deps.setLoadedInstructionFileName(null);
      deps.setInstructionFileError(null);
      resetInstructionMutationStatus();
    },

    async handleInstructionFileChange(
      event: ChangeEvent<HTMLInputElement>,
    ): Promise<void> {
      const input = event.currentTarget;
      if (deps.isArchivedThread(deps.readActiveThreadId())) {
        input.value = "";
        return;
      }

      const file = input.files?.[0];
      if (!file) {
        return;
      }

      deps.setInstructionFileError(null);

      const extension = readFileExtension(file.name);
      if (!INSTRUCTION_ALLOWED_EXTENSIONS.has(extension)) {
        deps.setInstructionFileError(
          "Only .md, .txt, .xml, and .json files are supported.",
        );
        input.value = "";
        return;
      }

      if (file.size > INSTRUCTION_MAX_FILE_SIZE_BYTES) {
        deps.setInstructionFileError(
          `Instruction file is too large. Max ${INSTRUCTION_MAX_FILE_SIZE_LABEL}.`,
        );
        input.value = "";
        return;
      }

      try {
        const text = await file.text();
        deps.setAgentInstruction(text);
        deps.setLoadedInstructionFileName(file.name);
        resetInstructionMutationStatus();
      } catch (readInstructionError) {
        deps.logClientError("read_instruction_file_failed", readInstructionError, {
          action: "load_instruction_file",
          context: {
            fileName: file.name,
            fileSize: file.size,
          },
        });
        deps.setInstructionFileError(
          "Failed to read the selected instruction file.",
        );
      } finally {
        input.value = "";
      }
    },
  };
}
