import {
  useRef,
  useState,
} from "react";
import {
  DEFAULT_AGENT_INSTRUCTION,
} from "~/lib/constants/chat";
import {
  cloneThreadInstructionContexts,
} from "~/lib/contracts/threads/state";
import {
  DEFAULT_THREAD_INSTRUCTION_CONTEXT_TOGGLES,
} from "~/lib/contracts/threads/instruction-context";
import type { ThreadState } from "~/lib/contracts/threads/types";
import type {
  InstructionEnhanceComparison,
} from "~/lib/client/usecase/workspace/types";

export function useInstructionEditor() {
  const instructionFileInputRef = useRef<HTMLInputElement | null>(null);

  const [agentInstruction, setAgentInstruction] = useState(
    DEFAULT_AGENT_INSTRUCTION,
  );
  const [instructionContextToggles, setInstructionContextToggles] = useState(
    cloneThreadInstructionContexts(DEFAULT_THREAD_INSTRUCTION_CONTEXT_TOGGLES),
  );
  const [loadedInstructionFileName, setLoadedInstructionFileName] = useState<
    string | null
  >(null);
  const [instructionFileError, setInstructionFileError] = useState<
    string | null
  >(null);
  const [instructionSaveError, setInstructionSaveError] = useState<
    string | null
  >(null);
  const [instructionSaveSuccess, setInstructionSaveSuccess] = useState<
    string | null
  >(null);
  const [isSavingInstructionPrompt, setIsSavingInstructionPrompt] =
    useState(false);
  const [instructionEnhanceError, setInstructionEnhanceError] = useState<
    string | null
  >(null);
  const [instructionEnhanceSuccess, setInstructionEnhanceSuccess] = useState<
    string | null
  >(null);
  const [isEnhancingInstruction, setIsEnhancingInstruction] = useState(false);
  const [instructionEnhancingThreadId, setInstructionEnhancingThreadId] =
    useState("");
  const [instructionEnhanceComparison, setInstructionEnhanceComparison] =
    useState<InstructionEnhanceComparison | null>(null);

  function resetInstructionEditor() {
    setAgentInstruction(DEFAULT_AGENT_INSTRUCTION);
    setInstructionContextToggles(
      cloneThreadInstructionContexts(DEFAULT_THREAD_INSTRUCTION_CONTEXT_TOGGLES),
    );
    setLoadedInstructionFileName(null);
    setInstructionFileError(null);
    setInstructionSaveError(null);
    setInstructionSaveSuccess(null);
    setInstructionEnhanceError(null);
    setInstructionEnhanceSuccess(null);
    setInstructionEnhancingThreadId("");
    setInstructionEnhanceComparison(null);
  }

  function applyThreadInstructionState(
    thread: Pick<ThreadState, "agentInstruction" | "instructionContextToggles">,
  ) {
    setAgentInstruction(thread.agentInstruction);
    setInstructionContextToggles(
      cloneThreadInstructionContexts(thread.instructionContextToggles),
    );
    setLoadedInstructionFileName(null);
    setInstructionFileError(null);
    setInstructionSaveError(null);
    setInstructionSaveSuccess(null);
    setInstructionEnhanceError(null);
    setInstructionEnhanceSuccess(null);
    setInstructionEnhanceComparison(null);
  }

  return {
    instructionFileInputRef,
    agentInstruction,
    setAgentInstruction,
    instructionContextToggles,
    setInstructionContextToggles,
    loadedInstructionFileName,
    setLoadedInstructionFileName,
    instructionFileError,
    setInstructionFileError,
    instructionSaveError,
    setInstructionSaveError,
    instructionSaveSuccess,
    setInstructionSaveSuccess,
    isSavingInstructionPrompt,
    setIsSavingInstructionPrompt,
    instructionEnhanceError,
    setInstructionEnhanceError,
    instructionEnhanceSuccess,
    setInstructionEnhanceSuccess,
    isEnhancingInstruction,
    setIsEnhancingInstruction,
    instructionEnhancingThreadId,
    setInstructionEnhancingThreadId,
    instructionEnhanceComparison,
    setInstructionEnhanceComparison,
    resetInstructionEditor,
    applyThreadInstructionState,
  };
}
