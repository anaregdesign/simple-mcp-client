import type { McpServerConfig } from "~/lib/contracts/mcp/profile";
import type { McpProfileFormState } from "./form";
import type { McpProfileState } from "./state";

export type McpProfileAction =
  | {
      type: "state/patched";
      patch: Partial<Omit<McpProfileState, "formState" | "workspaceMcpServerProfiles">>;
    }
  | {
      type: "form/patched";
      patch: Partial<McpProfileFormState>;
    }
  | {
      type: "profiles/set";
      profiles: McpServerConfig[];
    };

export function mcpProfileReducer(
  state: McpProfileState,
  action: McpProfileAction,
): McpProfileState {
  switch (action.type) {
    case "state/patched": {
      const patchEntries = Object.entries(action.patch) as Array<
        [keyof Omit<McpProfileState, "formState" | "workspaceMcpServerProfiles">, unknown]
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
    case "form/patched": {
      const patchEntries = Object.entries(action.patch) as Array<
        [keyof McpProfileFormState, McpProfileFormState[keyof McpProfileFormState]]
      >;
      const hasFormChange = patchEntries.some(
        ([key, value]) => !Object.is(state.formState[key], value),
      );
      if (!hasFormChange) {
        return state;
      }

      return {
        ...state,
        formState: {
          ...state.formState,
          ...action.patch,
        },
      };
    }
    case "profiles/set":
      if (Object.is(state.workspaceMcpServerProfiles, action.profiles)) {
        return state;
      }
      return {
        ...state,
        workspaceMcpServerProfiles: action.profiles,
      };
    default: {
      const exhaustiveAction: never = action;
      return exhaustiveAction;
    }
  }
}
