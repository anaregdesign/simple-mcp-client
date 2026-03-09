import type { ThemeMode } from "~/lib/domain/value-objects/theme-mode";

const themeModeValues = new Set<ThemeMode>(["light", "dark"]);

export function readThemeModeFromUnknown(value: unknown): ThemeMode | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized || !themeModeValues.has(normalized as ThemeMode)) {
    return null;
  }

  return normalized as ThemeMode;
}
