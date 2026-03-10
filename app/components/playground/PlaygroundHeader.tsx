import { FluentUI } from "~/components/shared/fluent";
import type {
  DesktopUpdaterActionStateView,
  DesktopUpdaterStatusView,
} from "~/lib/client/usecase/workspace/view-types";

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
    <header className="chat-header">
      <div className="chat-header-row">
        <div className="chat-header-main">
          <div className="chat-header-title-row">
            <div className="chat-header-title">
              <img
                className="chat-header-symbol"
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
                className="chat-header-upgrade-btn"
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
                className="chat-header-upgrade-btn"
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
                className="chat-header-upgrade-btn"
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
            <div className="chat-thread-header-controls">
              <span className="chat-thread-name-label" title={activeThreadName}>
                {activeThreadName}
              </span>
              <Button
                type="button"
                appearance="subtle"
                size="small"
                className="chat-thread-new-btn"
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
