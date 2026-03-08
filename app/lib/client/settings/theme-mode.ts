/**
 * Client runtime support module.
 */
import type { ThemeMode } from "~/lib/domain/shared/theme-mode";

const THEME_MODE_VALUES = new Set<ThemeMode>(["light", "dark"]);

export function readThemeModeFromUnknown(value: unknown): ThemeMode | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized || !THEME_MODE_VALUES.has(normalized as ThemeMode)) {
    return null;
  }

  return normalized as ThemeMode;
}
