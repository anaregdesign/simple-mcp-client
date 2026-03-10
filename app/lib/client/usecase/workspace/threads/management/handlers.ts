import { truncateThreadNameInput } from "~/lib/domain/value-objects/thread-name";

export type ThreadRenameKeyAction = "submit" | "cancel" | null;

export function normalizeThreadRenameInput(value: string): string {
  return truncateThreadNameInput(value);
}

export function resolveThreadRenameKeyAction(
  key: string,
): ThreadRenameKeyAction {
  if (key === "Enter") {
    return "submit";
  }

  if (key === "Escape") {
    return "cancel";
  }

  return null;
}
