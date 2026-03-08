/**
 * Test module verifying Home theme preference parsing behavior.
 */
import { describe, expect, it } from "vitest";
import { readThemeModeFromUnknown } from "~/lib/client/settings/theme-mode";

describe("readThemeModeFromUnknown", () => {
  it("accepts light and dark values", () => {
    expect(readThemeModeFromUnknown("light")).toBe("light");
    expect(readThemeModeFromUnknown("dark")).toBe("dark");
    expect(readThemeModeFromUnknown(" DARK ")).toBe("dark");
  });

  it("returns null for unsupported values", () => {
    expect(readThemeModeFromUnknown("system")).toBeNull();
    expect(readThemeModeFromUnknown(42)).toBeNull();
  });
});
