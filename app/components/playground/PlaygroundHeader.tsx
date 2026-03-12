import { FluentUI } from "~/components/shared/fluent";
import type {
  DesktopUpdaterActionStateView,
  DesktopUpdaterStatusView,
} from "~/lib/client/usecase/workspace/desktop-updater/view-types";
import styles from "~/components/playground/PlaygroundHeader.module.css";

const { Button } = FluentUI;

type PlaygroundHeaderProps = {
  desktopUpdaterStatus: DesktopUpdaterStatusView;
  desktopUpdaterActionState: DesktopUpdaterActionStateView;
  isApplyingDesktopUpdate: boolean;
  onCheckDesktopUpdates: () => void;
  onApplyDesktopUpdate: () => void;
  activeThreadName: string;
  isThreadOperationBusy: boolean;
  isCreatingThread: boolean;
  onCreateThread: () => void;
};

export function PlaygroundHeader({
  desktopUpdaterStatus,
  desktopUpdaterActionState,
  isApplyingDesktopUpdate,
  onCheckDesktopUpdates,
  onApplyDesktopUpdate,
  activeThreadName,
  isThreadOperationBusy,
  isCreatingThread,
  onCreateThread,
}: PlaygroundHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.row}>
        <div className={styles.main}>
          <div className={styles.titleRow}>
            <div className={styles.title}>
              <img
                className={styles.symbol}
                src="/local-playground-symbol.svg"
                alt=""
                aria-hidden="true"
              />
              <h1>Local Playground</h1>
            </div>
            {desktopUpdaterStatus.supported &&
            desktopUpdaterActionState === "check" ? (
              <Button
                type="button"
                appearance="subtle"
                size="small"
                className={styles.upgradeButton}
                aria-label="Check for updates"
                title={
                  desktopUpdaterStatus.lastCheckedAt
                    ? `Check for updates. Last checked at ${desktopUpdaterStatus.lastCheckedAt}.`
                    : "Check for updates."
                }
                onClick={onCheckDesktopUpdates}
                disabled={
                  desktopUpdaterStatus.checking || isApplyingDesktopUpdate
                }
              >
                {desktopUpdaterStatus.checking ? "Checking…" : "Check Updates"}
              </Button>
            ) : null}
            {desktopUpdaterStatus.supported &&
            desktopUpdaterActionState === "downloading" ? (
              <Button
                type="button"
                appearance="subtle"
                size="small"
                className={styles.upgradeButton}
                aria-label="Update download in progress"
                title={
                  desktopUpdaterStatus.availableVersion
                    ? `Version ${desktopUpdaterStatus.availableVersion} is downloading in the background.`
                    : "An update is downloading in the background."
                }
                disabled
              >
                Downloading…
              </Button>
            ) : null}
            {desktopUpdaterStatus.supported &&
            desktopUpdaterActionState === "upgrade" ? (
              <Button
                type="button"
                appearance="subtle"
                size="small"
                className={styles.upgradeButton}
                aria-label="Upgrade app"
                title={
                  desktopUpdaterStatus.availableVersion
                    ? `Restart and apply version ${desktopUpdaterStatus.availableVersion}.`
                    : "Restart and apply the downloaded update."
                }
                onClick={onApplyDesktopUpdate}
                disabled={isApplyingDesktopUpdate}
              >
                {isApplyingDesktopUpdate ? "Upgrading…" : "Upgrade"}
              </Button>
            ) : null}
            <div className={styles.threadControls}>
              <span className={styles.threadNameLabel} title={activeThreadName}>
                {activeThreadName}
              </span>
              <Button
                type="button"
                appearance="subtle"
                size="small"
                className={styles.newThreadButton}
                aria-label="Create new thread"
                title="Create a new thread and switch to Threads."
                onClick={onCreateThread}
                disabled={isThreadOperationBusy}
              >
                {isCreatingThread ? "…" : "+"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
