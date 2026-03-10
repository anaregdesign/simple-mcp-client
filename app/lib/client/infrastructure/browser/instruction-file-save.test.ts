import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isInstructionSaveCanceled,
  saveInstructionToClientFile,
} from "./instruction-file-save";

describe("instruction file save", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses showSaveFilePicker when available", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    const createWritable = vi.fn().mockResolvedValue({
      write,
      close,
    });
    const showSaveFilePicker = vi.fn().mockResolvedValue({
      name: "saved.md",
      createWritable,
    });

    vi.stubGlobal("window", {
      showSaveFilePicker,
    });

    await expect(saveInstructionToClientFile("hello", "instruction.md")).resolves.toEqual({
      fileName: "saved.md",
      mode: "picker",
    });
    expect(showSaveFilePicker).toHaveBeenCalledWith({
      suggestedName: "instruction.md",
      types: expect.any(Array),
    });
    expect(write).toHaveBeenCalledWith("hello");
    expect(close).toHaveBeenCalled();
  });

  it("detects save cancellation", () => {
    expect(isInstructionSaveCanceled(new DOMException("cancel", "AbortError"))).toBe(true);
    expect(isInstructionSaveCanceled(new Error("cancel"))).toBe(false);
  });
});
