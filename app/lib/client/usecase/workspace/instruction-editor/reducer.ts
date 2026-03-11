import type {
  InstructionEditorState,
} from "./state";

export type InstructionEditorAction = {
  type: "state/patched";
  patch: Partial<InstructionEditorState>;
};

export function instructionEditorReducer(
  state: InstructionEditorState,
  action: InstructionEditorAction,
): InstructionEditorState {
  switch (action.type) {
    case "state/patched": {
      const patchEntries = Object.entries(action.patch) as Array<
        [
          keyof InstructionEditorState,
          InstructionEditorState[keyof InstructionEditorState],
        ]
      >;
      const hasStateChange = patchEntries.some(
        ([key, value]) => !Object.is(state[key], value),
      );
      if (!hasStateChange) {
        return state;
      }

      return {
        ...state,
        ...action.patch,
      };
    }
  }

  return state;
}
