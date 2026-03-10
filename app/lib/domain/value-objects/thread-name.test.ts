import { describe, expect, it } from "vitest";
import {
  normalizeGeneratedThreadTitle,
  normalizeThreadName,
  THREAD_NAME_MAX_LENGTH,
  truncateThreadNameInput,
} from "~/lib/domain/value-objects/thread-name";

describe("thread-name", () => {
  it("normalizes persisted thread names by trimming and truncating", () => {
    expect(normalizeThreadName("  Release planning  ")).toBe("Release planning");
    expect(normalizeThreadName("a".repeat(300)).length).toBe(
      THREAD_NAME_MAX_LENGTH,
    );
  });

  it("truncates rename draft input without trimming", () => {
    expect(truncateThreadNameInput(`  ${"a".repeat(300)}`).length).toBe(
      THREAD_NAME_MAX_LENGTH,
    );
  });

  it("normalizes generated titles to a single unquoted line", () => {
    expect(
      normalizeGeneratedThreadTitle('  "Playground  plan"  \nsecond line'),
    ).toBe("Playground plan");
    expect(
      normalizeGeneratedThreadTitle("12345678901234567890xyz"),
    ).toBe("12345678901234567890");
  });
});
