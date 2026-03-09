import { describe, expect, it } from "vitest";
import { getFileExtension } from "./files";

describe("getFileExtension", () => {
  it("extracts lowercase extension from file names", () => {
    expect(getFileExtension("Prompt.JSON")).toBe("json");
    expect(getFileExtension("archive.tar.gz")).toBe("gz");
    expect(getFileExtension("no-extension")).toBe("");
    expect(getFileExtension("trailing-dot.")).toBe("");
  });
});
