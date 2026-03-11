export function clipTextForSkillTool(
  value: string,
  maxChars: number,
): {
  value: string;
  truncated: boolean;
} {
  if (value.length <= maxChars) {
    return {
      value,
      truncated: false,
    };
  }

  return {
    value: value.slice(0, maxChars),
    truncated: true,
  };
}
