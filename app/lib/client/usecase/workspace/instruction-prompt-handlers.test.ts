import { describe, expect, it, vi } from "vitest";
import {
  createInstructionPromptHandlers,
} from "~/lib/client/usecase/workspace/instruction-prompt-handlers";
import type { InstructionEnhanceComparison } from "~/lib/client/usecase/workspace/types";

function createBaseDependencies(
  overrides: Partial<
    Parameters<typeof createInstructionPromptHandlers>[0]
  > = {},
): Parameters<typeof createInstructionPromptHandlers>[0] {
  return {
    isArchivedThread: () => false,
    readActiveThreadId: () => "thread-1",
    readAgentInstruction: () => "Original instruction",
    readLoadedInstructionFileName: () => null,
    readInstructionEnhanceComparison: () => null,
    isSavingInstructionPrompt: false,
    setIsSavingInstructionPrompt: () => {},
    isEnhancingInstruction: false,
    setIsEnhancingInstruction: () => {},
    setInstructionEnhancingThreadId: () => {},
    setLoadedInstructionFileName: () => {},
    setInstructionFileError: () => {},
    setInstructionSaveError: () => {},
    setInstructionSaveSuccess: () => {},
    setInstructionEnhanceError: () => {},
    setInstructionEnhanceSuccess: () => {},
    setInstructionEnhanceComparison: () => {},
    setAgentInstruction: () => {},
    setActiveMainTab: () => {},
    isChatLocked: false,
    readActiveAzureTenantId: () => "tenant-a",
    readActiveUtilityAzureConnection: () => ({
      id: "project-1",
      projectName: "utility-project",
      baseUrl: "https://example.openai.azure.com",
      apiVersion: "2026-01-01",
    }),
    readSelectedUtilityAzureDeploymentName: () => "gpt-5",
    readUtilityAzureDeployments: () => [
      {
        name: "gpt-5",
        reasoningEffortOptions: ["none", "low", "medium", "high"],
      },
    ],
    isLoadingUtilityAzureDeployments: false,
    isUtilityReasoningEffortSupported: true,
    readEffectiveUtilityReasoningEffort: () => "medium",
    readEffectiveUtilityReasoningEffortOptions: () => [
      "none",
      "low",
      "medium",
      "high",
    ],
    handleSelectUtilityProject: () => {},
    handleSelectUtilityDeployment: () => {},
    handleAzureUtilityReasoningEffortChange: () => {},
    requestInstructionEnhancement: async () => ({ message: "" }),
    saveInstructionFile: async () => ({
      fileName: "instruction.md",
      mode: "download",
    }),
    isInstructionSaveCanceled: () => false,
    refreshThreadTitleInBackground: async () => {},
    logClientError: () => {},
    ...overrides,
  };
}

describe("createInstructionPromptHandlers", () => {
  it("saves the current instruction prompt via the injected file saver", async () => {
    const saveInstructionFile = vi.fn(async () => ({
      fileName: "instruction.md",
      mode: "picker" as const,
    }));
    const setLoadedInstructionFileName = vi.fn();
    const setInstructionSaveSuccess = vi.fn();
    const setIsSavingInstructionPrompt = vi.fn();
    const handlers = createInstructionPromptHandlers(
      createBaseDependencies({
        saveInstructionFile,
        readAgentInstruction: () => "# Original instruction",
        setLoadedInstructionFileName,
        setInstructionSaveSuccess,
        setIsSavingInstructionPrompt,
      }),
    );

    await handlers.handleSaveInstructionPrompt();

    expect(saveInstructionFile).toHaveBeenCalledWith(
      "# Original instruction",
      "instruction.md",
    );
    expect(setLoadedInstructionFileName).toHaveBeenCalledWith("instruction.md");
    expect(setInstructionSaveSuccess).toHaveBeenCalledWith(
      "Saved as instruction.md",
    );
    expect(setIsSavingInstructionPrompt).toHaveBeenNthCalledWith(1, true);
    expect(setIsSavingInstructionPrompt).toHaveBeenLastCalledWith(false);
  });

  it("builds an instruction comparison from the enhancement patch response", async () => {
    const requestInstructionEnhancement = vi.fn(async () => ({
      message: [
        "--- a/instruction.md",
        "+++ b/instruction.md",
        "@@ -1 +1 @@",
        "-# Original instruction",
        "+# Enhanced instruction",
      ].join("\n"),
    }));
    const setInstructionEnhancingThreadId = vi.fn();
    const setIsEnhancingInstruction = vi.fn();
    const setInstructionEnhanceComparison = vi.fn();
    const setInstructionEnhanceSuccess = vi.fn();
    const handlers = createInstructionPromptHandlers(
      createBaseDependencies({
        requestInstructionEnhancement,
        readAgentInstruction: () => "# Original instruction",
        setInstructionEnhancingThreadId,
        setIsEnhancingInstruction,
        setInstructionEnhanceComparison,
        setInstructionEnhanceSuccess,
      }),
    );

    await handlers.handleEnhanceInstruction();

    expect(requestInstructionEnhancement).toHaveBeenCalledWith(
      expect.objectContaining({
        azureConfig: expect.objectContaining({
          tenantId: "tenant-a",
          projectName: "utility-project",
          deploymentName: "gpt-5",
        }),
        reasoningEffort: "medium",
      }),
    );
    expect(setInstructionEnhancingThreadId).toHaveBeenNthCalledWith(
      1,
      "thread-1",
    );
    expect(setInstructionEnhanceComparison).toHaveBeenLastCalledWith({
      original: "# Original instruction",
      enhanced: "# Enhanced instruction",
      extension: "md",
      language: "english",
      diffPatch: [
        "--- a/instruction.md",
        "+++ b/instruction.md",
        "@@ -1 +1 @@",
        "-# Original instruction",
        "+# Enhanced instruction",
      ].join("\n"),
    });
    expect(setInstructionEnhanceSuccess).toHaveBeenCalledWith(
      "Review the diff and choose which version to adopt.",
    );
    expect(setIsEnhancingInstruction).toHaveBeenNthCalledWith(1, true);
    expect(setIsEnhancingInstruction).toHaveBeenLastCalledWith(false);
  });

  it("applies the enhanced instruction and refreshes the thread title", () => {
    const comparison: InstructionEnhanceComparison = {
      original: "Original instruction",
      enhanced: "Enhanced instruction",
      extension: "md",
      language: "english",
      diffPatch: "@@ -1 +1 @@",
    };
    const setAgentInstruction = vi.fn();
    const setInstructionEnhanceComparison = vi.fn();
    const setInstructionEnhanceSuccess = vi.fn();
    const refreshThreadTitleInBackground = vi.fn(async () => {});
    const handlers = createInstructionPromptHandlers(
      createBaseDependencies({
        readInstructionEnhanceComparison: () => comparison,
        setAgentInstruction,
        setInstructionEnhanceComparison,
        setInstructionEnhanceSuccess,
        refreshThreadTitleInBackground,
      }),
    );

    handlers.handleAdoptEnhancedInstruction();

    expect(setAgentInstruction).toHaveBeenCalledWith("Enhanced instruction");
    expect(setInstructionEnhanceComparison).toHaveBeenCalledWith(null);
    expect(setInstructionEnhanceSuccess).toHaveBeenCalledWith(
      "Enhanced instruction applied.",
    );
    expect(refreshThreadTitleInBackground).toHaveBeenCalledWith({
      threadId: "thread-1",
      reason: "instruction_update",
      instructionOverride: "Enhanced instruction",
    });
  });
});
