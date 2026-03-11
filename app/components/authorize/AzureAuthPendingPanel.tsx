/**
 * Client UI component module.
 */
import { FluentUI } from "~/components/shared/fluent";

const { Spinner } = FluentUI;

export function AzureAuthPendingPanel() {
  return (
    <section className="unauth-panel" aria-label="Checking Azure sign-in status">
      <header className="chat-header unauth-panel-header">
        <div className="chat-header-row">
          <div className="chat-header-main">
            <div className="chat-header-title">
              <img
                className="chat-header-symbol"
                src="/local-playground-symbol.svg"
                alt=""
                aria-hidden="true"
              />
              <h1>Local Playground</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="unauth-panel-body">
        <div className="unauth-status" role="status" aria-live="polite">
          <Spinner size="medium" />
          <p className="unauth-status-text">Checking Azure session...</p>
        </div>
      </div>
    </section>
  );
}
