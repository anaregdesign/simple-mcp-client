import { describe, expect, it } from "vitest";
import { readStringList, uniqueStringsCaseInsensitive } from "./collections";

describe("uniqueStringsCaseInsensitive", () => {
  it("deduplicates while preserving first appearance", () => {
    expect(uniqueStringsCaseInsensitive(["API", "api", "Trace", "TRACE", "Api"])).toEqual([
      "API",
      "Trace",
    ]);
  });
});

describe("readStringList", () => {
  it("returns trimmed non-empty strings from unknown arrays", () => {
    expect(readStringList(["  one ", "", " two", 3, null, "three  "])).toEqual([
      "one",
      "two",
      "three",
    ]);
  });

  it("returns empty list for non-array values", () => {
    expect(readStringList(null)).toEqual([]);
    expect(readStringList("value")).toEqual([]);
  });
});
