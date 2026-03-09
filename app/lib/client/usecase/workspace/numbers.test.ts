import { describe, expect, it } from "vitest";
import { clampNumber } from "./numbers";

describe("clampNumber", () => {
  it("clamps values and handles NaN", () => {
    expect(clampNumber(Number.NaN, 1, 10)).toBe(1);
    expect(clampNumber(-1, 1, 10)).toBe(1);
    expect(clampNumber(20, 1, 10)).toBe(10);
    expect(clampNumber(5, 1, 10)).toBe(5);
  });
});
