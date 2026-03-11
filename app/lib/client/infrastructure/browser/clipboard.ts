import {
  readClipboardWriteStrategy,
  type ClipboardWriteStrategy,
} from "~/lib/client/infrastructure/browser/workspace-runtime-capabilities";

export type ClipboardWriteResult = {
  strategy: Exclude<ClipboardWriteStrategy, "unavailable">;
};

/**
 * Client runtime support module.
 */
export async function copyTextToClipboard(
  text: string,
): Promise<ClipboardWriteResult> {
  const strategy = readClipboardWriteStrategy();
  if (strategy === "async-clipboard") {
    await navigator.clipboard.writeText(text);
    return {
      strategy,
    };
  }

  if (strategy === "unavailable") {
    throw new Error("Clipboard write is unavailable in this runtime.");
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) {
    throw new Error("Failed to copy text.");
  }

  return {
    strategy,
  };
}
