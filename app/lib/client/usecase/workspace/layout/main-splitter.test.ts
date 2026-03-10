/**
 * Test module verifying main-splitter behavior.
 */
import { describe, expect, it } from "vitest";
import {
  CLIENT_MAIN_SPLITTER_MIN_LEFT_WIDTH_PX,
  CLIENT_MAIN_SPLITTER_MIN_RIGHT_WIDTH_PX,
} from "~/lib/constants/client";
import { resolveMainSplitterMaxRightWidth } from "./main-splitter";

describe("resolveMainSplitterMaxRightWidth", () => {
  it("keeps right pane at least the configured minimum", () => {
    const tinyWidth = CLIENT_MAIN_SPLITTER_MIN_LEFT_WIDTH_PX - 100;
    expect(resolveMainSplitterMaxRightWidth(tinyWidth)).toBe(
      CLIENT_MAIN_SPLITTER_MIN_RIGHT_WIDTH_PX,
    );
  });

  it("uses remaining width when larger than right minimum", () => {
    const totalWidth =
      CLIENT_MAIN_SPLITTER_MIN_LEFT_WIDTH_PX +
      CLIENT_MAIN_SPLITTER_MIN_RIGHT_WIDTH_PX +
      200;

    expect(resolveMainSplitterMaxRightWidth(totalWidth)).toBe(
      totalWidth - CLIENT_MAIN_SPLITTER_MIN_LEFT_WIDTH_PX,
    );
  });
});
