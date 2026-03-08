/**
 * Client runtime support module.
 */
import {
  CLIENT_MAIN_SPLITTER_MIN_LEFT_WIDTH_PX,
  CLIENT_MAIN_SPLITTER_MIN_RIGHT_WIDTH_PX,
} from "~/lib/constants/client";

export function resolveMainSplitterMaxRightWidth(totalWidthPx: number): number {
  return Math.max(
    CLIENT_MAIN_SPLITTER_MIN_RIGHT_WIDTH_PX,
    totalWidthPx - CLIENT_MAIN_SPLITTER_MIN_LEFT_WIDTH_PX,
  );
}
