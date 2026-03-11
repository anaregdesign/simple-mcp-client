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
      strategy: "save-picker",
    });
    expect(showSaveFilePicker).toHaveBeenCalledWith({
      suggestedName: "instruction.md",
      types: expect.any(Array),
    });
    expect(write).toHaveBeenCalledWith("hello");
    expect(close).toHaveBeenCalled();
  });

  it("falls back to download when the save picker is blocked", async () => {
    const showSaveFilePicker = vi.fn().mockRejectedValue(
      new DOMException("blocked", "SecurityError"),
    );
    const append = vi.fn();
    const remove = vi.fn();
    const click = vi.fn();
    const createElement = vi.fn().mockReturnValue({
      click,
      remove,
      rel: "",
      href: "",
      download: "",
    });
    const createObjectURL = vi.fn().mockReturnValue("blob:instruction");
    const revokeObjectURL = vi.fn();
    const setTimeout = vi.fn((callback: () => void) => {
      callback();
      return 0;
    });

    vi.stubGlobal("window", {
      showSaveFilePicker,
      setTimeout,
    });
    vi.stubGlobal("document", {
      body: { append },
      createElement,
    });
    vi.stubGlobal("URL", {
      createObjectURL,
      revokeObjectURL,
    });

    await expect(saveInstructionToClientFile("hello", "instruction.md")).resolves.toEqual({
      fileName: "instruction.md",
      strategy: "download",
    });
    expect(click).toHaveBeenCalledOnce();
    expect(append).toHaveBeenCalledOnce();
    expect(setTimeout).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:instruction");
  });

  it("throws when neither picker nor download fallback is available", async () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("document", undefined);
    vi.stubGlobal("URL", undefined);

    await expect(
      saveInstructionToClientFile("hello", "instruction.md"),
    ).rejects.toThrow("Instruction file save is unavailable in this runtime.");
  });

  it("rethrows save cancellation", async () => {
    const cancellation = new DOMException("cancel", "AbortError");
    const showSaveFilePicker = vi.fn().mockRejectedValue(cancellation);

    vi.stubGlobal("window", {
      showSaveFilePicker,
    });

    await expect(
      saveInstructionToClientFile("hello", "instruction.md"),
    ).rejects.toBe(cancellation);
  });

  it("detects save cancellation", () => {
    expect(isInstructionSaveCanceled(new DOMException("cancel", "AbortError"))).toBe(true);
    expect(isInstructionSaveCanceled(new Error("cancel"))).toBe(false);
  });
});
