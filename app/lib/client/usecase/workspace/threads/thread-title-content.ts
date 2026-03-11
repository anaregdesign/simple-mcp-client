import type { ThreadMessage } from "~/lib/contracts/chat/messages";

const threadAutoTitleContextMaxCharacters = 3_000;
const threadAutoTitleContextMessageLimit = 8;

export function buildThreadAutoTitlePlaygroundContent(
  messages: ThreadMessage[],
): string {
  if (messages.length === 0) {
    return "";
  }

  const lines = messages
    .slice(-threadAutoTitleContextMessageLimit)
    .map((message) => {
      const content = message.content.replace(/\s+/g, " ").trim();
      if (!content) {
        return "";
      }

      return `${message.role === "user" ? "User" : "Assistant"}: ${content}`;
    })
    .filter((line) => line.length > 0);

  return truncateByCharacters(lines.join("\n"), threadAutoTitleContextMaxCharacters).trim();
}

function truncateByCharacters(value: string, maxCharacters: number): string {
  return Array.from(value).slice(0, maxCharacters).join("");
}
