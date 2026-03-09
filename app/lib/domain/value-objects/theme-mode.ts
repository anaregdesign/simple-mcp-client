export const themeModeValues = ["light", "dark"] as const;

export type ThemeMode = (typeof themeModeValues)[number];
