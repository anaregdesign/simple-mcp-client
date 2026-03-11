export type DesktopUpdaterStatus = {
  supported: boolean;
  checking: boolean;
  updateAvailable: boolean;
  updateDownloaded: boolean;
  currentVersion: string;
  availableVersion: string;
  errorMessage: string;
  lastCheckedAt: string;
};

export function readDesktopUpdaterStatusFromUnknown(
  value: unknown,
): DesktopUpdaterStatus | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const typedValue = value as Record<string, unknown>;
  const supported = readBoolean(typedValue.supported);
  const checking = readBoolean(typedValue.checking);
  const updateAvailable = readBoolean(typedValue.updateAvailable);
  const updateDownloaded = readBoolean(typedValue.updateDownloaded);
  if (
    supported === null ||
    checking === null ||
    updateAvailable === null ||
    updateDownloaded === null
  ) {
    return null;
  }

  return {
    supported,
    checking,
    updateAvailable,
    updateDownloaded,
    currentVersion: readTrimmedString(typedValue.currentVersion),
    availableVersion: readTrimmedString(typedValue.availableVersion),
    errorMessage: readTrimmedString(typedValue.errorMessage),
    lastCheckedAt: readTrimmedString(typedValue.lastCheckedAt),
  };
}

function readBoolean(value: unknown): boolean | null {
  if (typeof value !== "boolean") {
    return null;
  }

  return value;
}

function readTrimmedString(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}
