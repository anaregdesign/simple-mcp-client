import { describe, expect, it } from "vitest";
import {
  selectInstructionEditorViewModel,
} from "~/lib/client/usecase/workspace/instruction-editor/selectors";

describe("selectInstructionEditorViewModel", () => {
  it("exposes instruction interaction and active-thread enhancement flags", () => {
    const viewModel = selectInstructionEditorViewModel({
      agentInstruction: "Follow project rules.",
      loadedInstructionFileName: "prompt.md",
      instructionFileError: null,
      isEnhancingInstruction: true,
      instructionEnhancingThreadId: "thread-1",
      activeThreadId: "thread-1",
    });

    expect(viewModel.hasInstructionInteraction).toBe(true);
    expect(viewModel.canClearAgentInstruction).toBe(true);
    expect(viewModel.canSaveAgentInstructionPrompt).toBe(true);
    expect(viewModel.canEnhanceAgentInstruction).toBe(true);
    expect(viewModel.isEnhancingInstructionForActiveThread).toBe(true);
  });

  it("reports non-interactive blank state", () => {
    const viewModel = selectInstructionEditorViewModel({
      agentInstruction: "   ",
      loadedInstructionFileName: null,
      instructionFileError: null,
      isEnhancingInstruction: true,
      instructionEnhancingThreadId: "thread-2",
      activeThreadId: "thread-1",
    });

    expect(viewModel.hasInstructionInteraction).toBe(false);
    expect(viewModel.canClearAgentInstruction).toBe(false);
    expect(viewModel.canSaveAgentInstructionPrompt).toBe(false);
    expect(viewModel.canEnhanceAgentInstruction).toBe(false);
    expect(viewModel.isEnhancingInstructionForActiveThread).toBe(false);
  });
});
