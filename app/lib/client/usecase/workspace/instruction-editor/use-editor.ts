import {
  useReducer,
  useRef,
} from "react";
import {
  cloneThreadInstructionContexts,
} from "~/lib/client/usecase/workspace/threads/thread-state";
import type { ThreadState } from "~/lib/client/usecase/workspace/threads/thread-state";
import {
  createInitialInstructionEditorState,
  type InstructionEditorState,
} from "./state";
import {
  instructionEditorReducer,
} from "./reducer";

export function useInstructionEditor() {
  const instructionFileInputRef = useRef<HTMLInputElement | null>(null);
  const [state, dispatch] = useReducer(
    instructionEditorReducer,
    undefined,
    createInitialInstructionEditorState,
  );

  function patchState(
    patch: Partial<InstructionEditorState>,
  ) {
    dispatch({
      type: "state/patched",
      patch,
    });
  }

  function resetInstructionEditor() {
    patchState(createInitialInstructionEditorState());
  }

  function applyThreadInstructionState(
    thread: Pick<ThreadState, "agentInstruction" | "instructionContextToggles">,
  ) {
    patchState({
      agentInstruction: thread.agentInstruction,
      instructionContextToggles: cloneThreadInstructionContexts(
        thread.instructionContextToggles,
      ),
      loadedInstructionFileName: null,
      instructionFileError: null,
      instructionSaveError: null,
      instructionSaveSuccess: null,
      instructionEnhanceError: null,
      instructionEnhanceSuccess: null,
      instructionEnhanceComparison: null,
    });
  }

  return {
    instructionFileInputRef,
    agentInstruction: state.agentInstruction,
    setAgentInstruction: (value: string) => {
      patchState({
        agentInstruction: value,
      });
    },
    instructionContextToggles: state.instructionContextToggles,
    setInstructionContextToggles: (
      value:
        | InstructionEditorState["instructionContextToggles"]
        | ((
            current: InstructionEditorState["instructionContextToggles"],
          ) => InstructionEditorState["instructionContextToggles"]),
    ) => {
      patchState({
        instructionContextToggles:
          typeof value === "function"
            ? (value as (
                current: InstructionEditorState["instructionContextToggles"],
              ) => InstructionEditorState["instructionContextToggles"])(
                state.instructionContextToggles,
              )
            : value,
      });
    },
    loadedInstructionFileName: state.loadedInstructionFileName,
    setLoadedInstructionFileName: (value: string | null) => {
      patchState({
        loadedInstructionFileName: value,
      });
    },
    instructionFileError: state.instructionFileError,
    setInstructionFileError: (value: string | null) => {
      patchState({
        instructionFileError: value,
      });
    },
    instructionSaveError: state.instructionSaveError,
    setInstructionSaveError: (value: string | null) => {
      patchState({
        instructionSaveError: value,
      });
    },
    instructionSaveSuccess: state.instructionSaveSuccess,
    setInstructionSaveSuccess: (value: string | null) => {
      patchState({
        instructionSaveSuccess: value,
      });
    },
    isSavingInstructionPrompt: state.isSavingInstructionPrompt,
    setIsSavingInstructionPrompt: (value: boolean) => {
      patchState({
        isSavingInstructionPrompt: value,
      });
    },
    instructionEnhanceError: state.instructionEnhanceError,
    setInstructionEnhanceError: (value: string | null) => {
      patchState({
        instructionEnhanceError: value,
      });
    },
    instructionEnhanceSuccess: state.instructionEnhanceSuccess,
    setInstructionEnhanceSuccess: (value: string | null) => {
      patchState({
        instructionEnhanceSuccess: value,
      });
    },
    isEnhancingInstruction: state.isEnhancingInstruction,
    setIsEnhancingInstruction: (value: boolean) => {
      patchState({
        isEnhancingInstruction: value,
      });
    },
    instructionEnhancingThreadId: state.instructionEnhancingThreadId,
    setInstructionEnhancingThreadId: (value: string) => {
      patchState({
        instructionEnhancingThreadId: value,
      });
    },
    instructionEnhanceComparison: state.instructionEnhanceComparison,
    setInstructionEnhanceComparison: (
      value: InstructionEditorState["instructionEnhanceComparison"],
    ) => {
      patchState({
        instructionEnhanceComparison: value,
      });
    },
    resetInstructionEditor,
    applyThreadInstructionState,
  };
}
