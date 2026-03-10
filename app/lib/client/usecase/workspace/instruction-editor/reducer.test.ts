import {
  describe,
  expect,
  it,
} from "vitest";
import {
  instructionEditorReducer,
} from "./reducer";
import {
  createInitialInstructionEditorState,
} from "./state";

describe("instructionEditorReducer", () => {
  it("patches editor state fields", () => {
    const state = createInitialInstructionEditorState();
    const next = instructionEditorReducer(state, {
      type: "state/patched",
      patch: {
        agentInstruction: "Updated instruction",
        isSavingInstructionPrompt: true,
      },
    });

    expect(next.agentInstruction).toBe("Updated instruction");
    expect(next.isSavingInstructionPrompt).toBe(true);
  });

  it("returns the same state for no-op patches", () => {
    const state = createInitialInstructionEditorState();
    const next = instructionEditorReducer(state, {
      type: "state/patched",
      patch: {
        agentInstruction: state.agentInstruction,
      },
    });

    expect(next).toBe(state);
  });
});
