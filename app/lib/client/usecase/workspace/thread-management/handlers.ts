import { THREAD_NAME_MAX_LENGTH } from "~/lib/constants/client";

export type ThreadRenameKeyAction = "submit" | "cancel" | null;

export function normalizeThreadRenameInput(value: string): string {
  return value.slice(0, THREAD_NAME_MAX_LENGTH);
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
