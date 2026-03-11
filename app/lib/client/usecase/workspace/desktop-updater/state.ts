import type { DesktopUpdaterStatus } from "~/lib/client/infrastructure/browser/desktop-updater";

const DEFAULT_DESKTOP_UPDATER_STATUS: DesktopUpdaterStatus = {
  supported: false,
  checking: false,
  updateAvailable: false,
  updateDownloaded: false,
  currentVersion: "",
  availableVersion: "",
  errorMessage: "",
  lastCheckedAt: "",
};

export function getDefaultDesktopUpdaterStatus(): DesktopUpdaterStatus {
  return {
    ...DEFAULT_DESKTOP_UPDATER_STATUS,
  };
}
