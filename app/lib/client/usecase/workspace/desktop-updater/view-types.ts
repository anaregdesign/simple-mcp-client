export type DesktopUpdaterStatusView = {
  supported: boolean;
  checking: boolean;
  updateAvailable: boolean;
  updateDownloaded: boolean;
  currentVersion: string;
  availableVersion: string;
  errorMessage: string;
  lastCheckedAt: string;
};

export type DesktopUpdaterActionStateView =
  | "check"
  | "downloading"
  | "upgrade";
