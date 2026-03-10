import { describe, expect, it } from "vitest";
import { hasPersistableThreadState } from "~/lib/domain/policies/thread-persistable-state";

describe("thread-persistable-state policy", () => {
  it("treats default thread state as non-persistable", () => {
    expect(
      hasPersistableThreadState({
        messageCount: 0,
        skillSelectionCount: 0,
        reasoningEffort: "none",
        webSearchEnabled: false,
        chatAzureConfig: null,
        instructionContent:
          "You are a concise assistant for a local playground app.",
        instructionContextToggles: { system: true },
        threadEnvironment: {},
      }),
    ).toBe(false);
  });

  it("treats custom instruction as persistable", () => {
    expect(
      hasPersistableThreadState({
        messageCount: 0,
        skillSelectionCount: 0,
        reasoningEffort: "none",
        webSearchEnabled: false,
        chatAzureConfig: null,
        instructionContent: "Respond with explicit assumptions.",
        instructionContextToggles: { system: true },
        threadEnvironment: {},
      }),
    ).toBe(true);
  });
});
