import {
  useEffect,
  useEffectEvent,
  useState,
} from "react";
import {
  readDesktopApi,
  readDesktopUpdaterStatusFromUnknown,
} from "~/lib/client/infrastructure/browser/desktop-updater";
import {
  resolveDesktopUpdaterActionState,
} from "~/lib/client/usecase/workspace/desktop-updater/selectors";
import {
  getDefaultDesktopUpdaterStatus,
} from "~/lib/client/usecase/workspace/desktop-updater/state";

type ClientErrorLogger = (
  eventName: string,
  error: unknown,
  options?: {
    category?: string;
    location?: string;
    action?: string;
    statusCode?: number;
    context?: Record<string, unknown>;
  },
) => void;

type ClientWarningLogger = (
  eventName: string,
  message: string,
  options?: {
    category?: string;
    location?: string;
    action?: string;
    context?: Record<string, unknown>;
  },
) => void;

type UseWorkspaceDesktopUpdaterOptions = {
  setUiError: (value: string | null) => void;
  setSystemNotice: (value: string | null) => void;
  logClientError: ClientErrorLogger;
  logClientWarning: ClientWarningLogger;
};

export function useWorkspaceDesktopUpdater(
  options: UseWorkspaceDesktopUpdaterOptions,
) {
  const [desktopUpdaterStatus, setDesktopUpdaterStatus] = useState(
    getDefaultDesktopUpdaterStatus,
  );
  const [isApplyingDesktopUpdate, setIsApplyingDesktopUpdate] = useState(false);

  const applyDesktopUpdaterStatus = useEffectEvent(
    (payload: unknown) => {
      const parsed = readDesktopUpdaterStatusFromUnknown(payload);
      if (!parsed) {
        return null;
      }

      setDesktopUpdaterStatus(parsed);
      return parsed;
    },
  );

  const reportDesktopUpdaterStatusReadFailure = useEffectEvent(
    (error: unknown) => {
      options.logClientWarning(
        "desktop_updater_status_read_failed",
        error instanceof Error ? error.message : "Unknown error.",
        {
          location: "controller.desktopUpdater",
        },
      );
    },
  );

  useEffect(() => {
    const desktopApi = readDesktopApi();
    if (!desktopApi) {
      setDesktopUpdaterStatus(getDefaultDesktopUpdaterStatus());
      return;
    }

    let isActive = true;

    void desktopApi
      .getUpdaterStatus()
      .then((payload) => {
        if (!isActive) {
          return;
        }

        applyDesktopUpdaterStatus(payload);
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        reportDesktopUpdaterStatusReadFailure(error);
      });

    const unsubscribe = desktopApi.onUpdaterStatus((payload) => {
      if (!isActive) {
        return;
      }

      applyDesktopUpdaterStatus(payload);
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, []);

  async function handleApplyDesktopUpdate() {
    const desktopApi = readDesktopApi();
    if (
      !desktopApi ||
      !desktopUpdaterStatus.updateDownloaded ||
      isApplyingDesktopUpdate
    ) {
      return;
    }

    setIsApplyingDesktopUpdate(true);
    options.setUiError(null);
    try {
      await desktopApi.quitAndInstallUpdate();
    } catch (error) {
      options.logClientError("desktop_update_apply_failed", error, {
        action: "desktop_updater.quitAndInstallUpdate",
        location: "controller.desktopUpdater",
        context: {
          availableVersion: desktopUpdaterStatus.availableVersion,
        },
      });
      options.setUiError(
        error instanceof Error
          ? error.message
          : "Failed to apply desktop update.",
      );
      setIsApplyingDesktopUpdate(false);
    }
  }

  async function handleCheckDesktopUpdates() {
    const desktopApi = readDesktopApi();
    if (
      !desktopApi ||
      !desktopUpdaterStatus.supported ||
      desktopUpdaterStatus.checking
    ) {
      return;
    }

    options.setUiError(null);
    try {
      const payload = await desktopApi.checkForUpdates();
      const parsed = applyDesktopUpdaterStatus(payload);
      if (!parsed) {
        options.setSystemNotice("Update check completed.");
        return;
      }

      if (parsed.errorMessage) {
        options.setUiError(parsed.errorMessage);
        return;
      }

      if (parsed.updateDownloaded) {
        options.setSystemNotice(
          parsed.availableVersion
            ? `Version ${parsed.availableVersion} is downloaded. Use Upgrade to apply it.`
            : "An update is downloaded. Use Upgrade to apply it.",
        );
        return;
      }

      if (parsed.updateAvailable) {
        options.setSystemNotice(
          parsed.availableVersion
            ? `Version ${parsed.availableVersion} is available and downloading in the background.`
            : "A new version is available and downloading in the background.",
        );
        return;
      }

      options.setSystemNotice(
        parsed.currentVersion
          ? `No updates found. Current version is ${parsed.currentVersion}.`
          : "No updates found.",
      );
    } catch (error) {
      options.logClientError("desktop_update_check_failed", error, {
        action: "desktop_updater.checkForUpdates",
        location: "controller.desktopUpdater",
        context: {
          currentVersion: desktopUpdaterStatus.currentVersion,
        },
      });
      options.setUiError(
        error instanceof Error
          ? error.message
          : "Failed to check desktop updates.",
      );
    }
  }

  return {
    desktopUpdaterStatus,
    desktopUpdaterActionState:
      resolveDesktopUpdaterActionState(desktopUpdaterStatus),
    isApplyingDesktopUpdate,
    handleApplyDesktopUpdate,
    handleCheckDesktopUpdates,
  };
}
