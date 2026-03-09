import { afterEach, describe, expect, it, vi } from "vitest";
import { createId } from "./ids";

describe("createId", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates prefixed ids", () => {
    vi.spyOn(Date, "now").mockReturnValue(1700000000000);
    vi.spyOn(Math, "random").mockReturnValue(0.987654321);

    const id = createId("turn");

    expect(id.startsWith("turn-1700000000000-")).toBe(true);
  });
});
