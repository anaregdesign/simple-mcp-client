import { THREAD_AUTO_TITLE_MAX_LENGTH } from "~/lib/constants/chat";

export function buildThreadAutoTitleRequestMessage(options: {
  playgroundContent: string;
  instruction: string;
}): string {
  const payload = {
    objective: "Generate a concise thread title.",
    constraints: {
      maxCharacters: THREAD_AUTO_TITLE_MAX_LENGTH,
      useInstruction: true,
      output: "single plain-text title only",
    },
    playgroundContent: options.playgroundContent.trim(),
    instruction: options.instruction.trim(),
  };

  return [
    "Create a thread title from the payload.",
    "Use both playgroundContent and instruction.",
    "Return only the title text.",
    JSON.stringify(payload),
  ].join("\n");
}

function truncateByCharacters(value: string, maxCharacters: number): string {
  return Array.from(value).slice(0, maxCharacters).join("");
}
