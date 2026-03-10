import type { DesktopUpdaterStatus } from "~/lib/client/infrastructure/browser/desktop-updater";

export type DesktopUpdaterActionState = "check" | "downloading" | "upgrade";

export function resolveDesktopUpdaterActionState(
  status: Pick<DesktopUpdaterStatus, "updateAvailable" | "updateDownloaded">,
): DesktopUpdaterActionState {
  if (status.updateDownloaded) {
    return "upgrade";
  }

  if (status.updateAvailable) {
    return "downloading";
  }

  return "check";
}
