export const THREAD_NAME_MAX_LENGTH = 80;
export const THREAD_AUTO_TITLE_MAX_LENGTH = 20;

export function truncateThreadNameInput(value: string): string {
  return truncateByCharacters(value, THREAD_NAME_MAX_LENGTH);
}

export function normalizeThreadName(value: string): string {
  return truncateByCharacters(value.trim(), THREAD_NAME_MAX_LENGTH).trim();
}

export function normalizeGeneratedThreadTitle(value: string): string {
  const firstLine = value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!firstLine) {
    return "";
  }

  const collapsed = firstLine.replace(/\s+/g, " ").trim();
  const unquoted = collapsed.replace(/^[`"'「『]+|[`"'」』]+$/g, "").trim();
  if (!unquoted) {
    return "";
  }

  return truncateByCharacters(unquoted, THREAD_AUTO_TITLE_MAX_LENGTH).trim();
}

function truncateByCharacters(value: string, maxCharacters: number): string {
  return Array.from(value).slice(0, maxCharacters).join("");
}
