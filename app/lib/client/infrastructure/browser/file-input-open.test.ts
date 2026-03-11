import { describe, expect, it, vi } from "vitest";
import { openClientFileInputPicker } from "./file-input-open";

describe("openClientFileInputPicker", () => {
  it("prefers showPicker when available", () => {
    const showPicker = vi.fn();
    const click = vi.fn();
    const input = {
      disabled: false,
      click,
      showPicker,
    } as unknown as HTMLInputElement;

    expect(openClientFileInputPicker(input)).toBe(true);
    expect(showPicker).toHaveBeenCalledOnce();
    expect(click).not.toHaveBeenCalled();
  });

  it("falls back to click when showPicker throws", () => {
    const showPicker = vi.fn(() => {
      throw new DOMException("Not allowed", "NotAllowedError");
    });
    const click = vi.fn();
    const input = {
      disabled: false,
      click,
      showPicker,
    } as unknown as HTMLInputElement;

    expect(openClientFileInputPicker(input)).toBe(true);
    expect(showPicker).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
  });

  it("returns false when the input is unavailable", () => {
    expect(openClientFileInputPicker(null)).toBe(false);
  });
});
