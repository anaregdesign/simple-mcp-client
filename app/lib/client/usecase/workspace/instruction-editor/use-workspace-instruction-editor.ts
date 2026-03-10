import { useMemo } from "react";
import {
  createInstructionEditingHandlers,
} from "~/lib/client/usecase/workspace/instruction-editor/instruction-editing-handlers";
import {
  createInstructionPromptHandlers,
} from "~/lib/client/usecase/workspace/instruction-editor/instruction-prompt-handlers";
import {
  selectInstructionEditorViewModel,
} from "~/lib/client/usecase/workspace/instruction-editor/selectors";
import {
  useInstructionEditor,
} from "~/lib/client/usecase/workspace/instruction-editor/use-instruction-editor";

type UseWorkspaceInstructionEditorOptions = {
  activeThreadId: string;
  editing: Omit<
    Parameters<typeof createInstructionEditingHandlers>[0],
    | "setInstructionContextToggles"
    | "setAgentInstruction"
    | "setLoadedInstructionFileName"
    | "setInstructionFileError"
    | "setInstructionSaveError"
    | "setInstructionSaveSuccess"
    | "setInstructionEnhanceError"
    | "setInstructionEnhanceSuccess"
    | "setInstructionEnhanceComparison"
    | "readInstructionFileInput"
  >;
  prompt: Omit<
    Parameters<typeof createInstructionPromptHandlers>[0],
    | "readAgentInstruction"
    | "readLoadedInstructionFileName"
    | "readInstructionEnhanceComparison"
    | "isSavingInstructionPrompt"
    | "setIsSavingInstructionPrompt"
    | "isEnhancingInstruction"
    | "setIsEnhancingInstruction"
    | "setInstructionEnhancingThreadId"
    | "setLoadedInstructionFileName"
    | "setInstructionFileError"
    | "setInstructionSaveError"
    | "setInstructionSaveSuccess"
    | "setInstructionEnhanceError"
    | "setInstructionEnhanceSuccess"
    | "setInstructionEnhanceComparison"
    | "setAgentInstruction"
  >;
};

export function useWorkspaceInstructionEditor(
  options: UseWorkspaceInstructionEditorOptions,
) {
  const editor = useInstructionEditor();

  const viewModel = useMemo(
    () =>
      selectInstructionEditorViewModel({
        agentInstruction: editor.agentInstruction,
        loadedInstructionFileName: editor.loadedInstructionFileName,
        instructionFileError: editor.instructionFileError,
        isEnhancingInstruction: editor.isEnhancingInstruction,
        instructionEnhancingThreadId: editor.instructionEnhancingThreadId,
        activeThreadId: options.activeThreadId,
      }),
    [
      editor.agentInstruction,
      editor.instructionEnhancingThreadId,
      editor.instructionFileError,
      editor.isEnhancingInstruction,
      editor.loadedInstructionFileName,
      options.activeThreadId,
    ],
  );

  const editingHandlers = createInstructionEditingHandlers({
    ...options.editing,
    readInstructionFileInput: () => editor.instructionFileInputRef.current,
    setInstructionContextToggles: editor.setInstructionContextToggles,
    setAgentInstruction: editor.setAgentInstruction,
    setLoadedInstructionFileName: editor.setLoadedInstructionFileName,
    setInstructionFileError: editor.setInstructionFileError,
    setInstructionSaveError: editor.setInstructionSaveError,
    setInstructionSaveSuccess: editor.setInstructionSaveSuccess,
    setInstructionEnhanceError: editor.setInstructionEnhanceError,
    setInstructionEnhanceSuccess: editor.setInstructionEnhanceSuccess,
    setInstructionEnhanceComparison: editor.setInstructionEnhanceComparison,
  });

  const promptHandlers = createInstructionPromptHandlers({
    ...options.prompt,
    readAgentInstruction: () => editor.agentInstruction,
    readLoadedInstructionFileName: () => editor.loadedInstructionFileName,
    readInstructionEnhanceComparison: () =>
      editor.instructionEnhanceComparison,
    isSavingInstructionPrompt: editor.isSavingInstructionPrompt,
    setIsSavingInstructionPrompt: editor.setIsSavingInstructionPrompt,
    isEnhancingInstruction: editor.isEnhancingInstruction,
    setIsEnhancingInstruction: editor.setIsEnhancingInstruction,
    setInstructionEnhancingThreadId: editor.setInstructionEnhancingThreadId,
    setLoadedInstructionFileName: editor.setLoadedInstructionFileName,
    setInstructionFileError: editor.setInstructionFileError,
    setInstructionSaveError: editor.setInstructionSaveError,
    setInstructionSaveSuccess: editor.setInstructionSaveSuccess,
    setInstructionEnhanceError: editor.setInstructionEnhanceError,
    setInstructionEnhanceSuccess: editor.setInstructionEnhanceSuccess,
    setInstructionEnhanceComparison: editor.setInstructionEnhanceComparison,
    setAgentInstruction: editor.setAgentInstruction,
  });

  return {
    agentInstruction: editor.agentInstruction,
    instructionContextToggles: editor.instructionContextToggles,
    loadedInstructionFileName: editor.loadedInstructionFileName,
    instructionFileInputRef: editor.instructionFileInputRef,
    instructionFileError: editor.instructionFileError,
    instructionSaveError: editor.instructionSaveError,
    instructionSaveSuccess: editor.instructionSaveSuccess,
    isSavingInstructionPrompt: editor.isSavingInstructionPrompt,
    instructionEnhanceError: editor.instructionEnhanceError,
    instructionEnhanceSuccess: editor.instructionEnhanceSuccess,
    isEnhancingInstruction: editor.isEnhancingInstruction,
    instructionEnhancingThreadId: editor.instructionEnhancingThreadId,
    instructionEnhanceComparison: editor.instructionEnhanceComparison,
    canClearAgentInstruction: viewModel.canClearAgentInstruction,
    canSaveAgentInstructionPrompt: viewModel.canSaveAgentInstructionPrompt,
    canEnhanceAgentInstruction: viewModel.canEnhanceAgentInstruction,
    isEnhancingInstructionForActiveThread:
      viewModel.isEnhancingInstructionForActiveThread,
    clearInstructionSaveSuccess() {
      editor.setInstructionSaveSuccess(null);
    },
    clearInstructionEnhanceSuccess() {
      editor.setInstructionEnhanceSuccess(null);
    },
    ...editingHandlers,
    ...promptHandlers,
    resetInstructionEditor: editor.resetInstructionEditor,
    applyThreadInstructionState: editor.applyThreadInstructionState,
  };
}

export type WorkspaceInstructionEditorController = ReturnType<
  typeof useWorkspaceInstructionEditor
>;
