/**
 * Client UI component module.
 */
import { FluentUI } from "~/components/shared/fluent";
import styles from "~/components/authorize/AuthorizePanel.module.css";

const { Spinner } = FluentUI;

export function AzureAuthPendingPanel() {
  return (
    <section className={styles.panel} aria-label="Checking Azure sign-in status">
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <div className={styles.headerMain}>
            <div className={styles.headerTitle}>
              <img
                className={styles.symbol}
                src="/local-playground-symbol.svg"
                alt=""
                aria-hidden="true"
              />
              <h1>Local Playground</h1>
            </div>
          </div>
        </div>
      </header>

      <div className={styles.body}>
        <div className={styles.status} role="status" aria-live="polite">
          <Spinner size="medium" />
          <p className={styles.statusText}>Checking Azure session...</p>
        </div>
      </div>
    </section>
  );
}
