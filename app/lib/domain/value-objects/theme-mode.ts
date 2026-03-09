export const themeModeValues = ["light", "dark"] as const;

export type ThemeMode = (typeof themeModeValues)[number];

const themeModeValueSet = new Set<ThemeMode>(themeModeValues);

export function readThemeModeFromUnknown(value: unknown): ThemeMode | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized || !themeModeValueSet.has(normalized as ThemeMode)) {
    return null;
  }

  return normalized as ThemeMode;
}
