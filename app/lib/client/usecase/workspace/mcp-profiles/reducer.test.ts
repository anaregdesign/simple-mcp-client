import {
  describe,
  expect,
  it,
} from "vitest";
import {
  mcpProfileReducer,
} from "./reducer";
import {
  createInitialMcpProfileState,
} from "./state";

describe("mcpProfileReducer", () => {
  it("patches form fields", () => {
    const state = createInitialMcpProfileState();
    const next = mcpProfileReducer(state, {
      type: "form/patched",
      patch: {
        mcpNameInput: "Profile A",
        editingMcpServerId: "server-a",
      },
    });

    expect(next.formState.mcpNameInput).toBe("Profile A");
    expect(next.formState.editingMcpServerId).toBe("server-a");
  });

  it("patches feature flags", () => {
    const state = createInitialMcpProfileState();
    const next = mcpProfileReducer(state, {
      type: "state/patched",
      patch: {
        isSavingMcpServer: true,
      },
    });

    expect(next.isSavingMcpServer).toBe(true);
  });
});
