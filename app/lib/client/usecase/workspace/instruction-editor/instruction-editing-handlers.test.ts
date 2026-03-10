import type { ChangeEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  createInstructionEditingHandlers,
} from "~/lib/client/usecase/workspace/instruction-editor/instruction-editing-handlers";
import { DEFAULT_THREAD_INSTRUCTION_CONTEXT_TOGGLES } from "~/lib/contracts/threads/instruction-context";

describe("createInstructionEditingHandlers", () => {
  it("updates the instruction value and resets mutation status", () => {
    const setAgentInstruction = vi.fn();
    const setInstructionSaveError = vi.fn();
    const setInstructionSaveSuccess = vi.fn();
    const setInstructionEnhanceError = vi.fn();
    const setInstructionEnhanceSuccess = vi.fn();
    const setInstructionEnhanceComparison = vi.fn();
    const handlers = createInstructionEditingHandlers({
      isArchivedThread: () => false,
      readActiveThreadId: () => "thread-1",
      setInstructionContextToggles: () => {},
      setAgentInstruction,
      setLoadedInstructionFileName: () => {},
      setInstructionFileError: () => {},
      setInstructionSaveError,
      setInstructionSaveSuccess,
      setInstructionEnhanceError,
      setInstructionEnhanceSuccess,
      setInstructionEnhanceComparison,
      logClientError: () => {},
    });

    handlers.handleAgentInstructionChange("Updated instruction");

    expect(setAgentInstruction).toHaveBeenCalledWith("Updated instruction");
    expect(setInstructionSaveError).toHaveBeenCalledWith(null);
    expect(setInstructionSaveSuccess).toHaveBeenCalledWith(null);
    expect(setInstructionEnhanceError).toHaveBeenCalledWith(null);
    expect(setInstructionEnhanceSuccess).toHaveBeenCalledWith(null);
    expect(setInstructionEnhanceComparison).toHaveBeenCalledWith(null);
  });

  it("loads a supported instruction file into state", async () => {
    const setInstructionContextToggles = vi.fn();
    const setAgentInstruction = vi.fn();
    const setLoadedInstructionFileName = vi.fn();
    const setInstructionFileError = vi.fn();
    const setInstructionSaveError = vi.fn();
    const setInstructionSaveSuccess = vi.fn();
    const setInstructionEnhanceError = vi.fn();
    const setInstructionEnhanceSuccess = vi.fn();
    const setInstructionEnhanceComparison = vi.fn();
    const handlers = createInstructionEditingHandlers({
      isArchivedThread: () => false,
      readActiveThreadId: () => "thread-1",
      setInstructionContextToggles,
      setAgentInstruction,
      setLoadedInstructionFileName,
      setInstructionFileError,
      setInstructionSaveError,
      setInstructionSaveSuccess,
      setInstructionEnhanceError,
      setInstructionEnhanceSuccess,
      setInstructionEnhanceComparison,
      logClientError: () => {},
    });
    const file = new File(["# Instruction"], "instruction.md", {
      type: "text/markdown",
    });
    const input = {
      files: [file],
      value: "selected",
    } as unknown as HTMLInputElement;

    await handlers.handleInstructionFileChange({
      currentTarget: input,
    } as ChangeEvent<HTMLInputElement>);

    expect(setInstructionContextToggles).not.toHaveBeenCalled();
    expect(setInstructionFileError).toHaveBeenCalledWith(null);
    expect(setAgentInstruction).toHaveBeenCalledWith("# Instruction");
    expect(setLoadedInstructionFileName).toHaveBeenCalledWith("instruction.md");
    expect(setInstructionSaveError).toHaveBeenCalledWith(null);
    expect(setInstructionSaveSuccess).toHaveBeenCalledWith(null);
    expect(setInstructionEnhanceError).toHaveBeenCalledWith(null);
    expect(setInstructionEnhanceSuccess).toHaveBeenCalledWith(null);
    expect(setInstructionEnhanceComparison).toHaveBeenCalledWith(null);
    expect(input.value).toBe("");
  });

  it("updates instruction context toggles when the thread is editable", () => {
    const setInstructionContextToggles = vi.fn();
    const handlers = createInstructionEditingHandlers({
      isArchivedThread: () => false,
      readActiveThreadId: () => "thread-1",
      setInstructionContextToggles,
      setAgentInstruction: () => {},
      setLoadedInstructionFileName: () => {},
      setInstructionFileError: () => {},
      setInstructionSaveError: () => {},
      setInstructionSaveSuccess: () => {},
      setInstructionEnhanceError: () => {},
      setInstructionEnhanceSuccess: () => {},
      setInstructionEnhanceComparison: () => {},
      logClientError: () => {},
    });

    handlers.handleInstructionContextToggleChange("system", false);

    const updater = setInstructionContextToggles.mock.calls[0]?.[0] as
      | ((current: typeof DEFAULT_THREAD_INSTRUCTION_CONTEXT_TOGGLES) => typeof DEFAULT_THREAD_INSTRUCTION_CONTEXT_TOGGLES)
      | undefined;
    expect(updater?.(DEFAULT_THREAD_INSTRUCTION_CONTEXT_TOGGLES)).toEqual({
      system: false,
    });
  });
});
