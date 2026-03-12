/**
 * Client UI component module.
 */
import { FluentUI } from "~/components/shared/fluent";
import styles from "~/components/authorize/AuthorizePanel.module.css";

const { Button } = FluentUI;

type UnauthenticatedPanelProps = {
  isStartingAzureLogin: boolean;
  onAzureLogin: () => void | Promise<void>;
};

export function UnauthenticatedPanel(props: UnauthenticatedPanelProps) {
  const { isStartingAzureLogin, onAzureLogin } = props;

  return (
    <section className={styles.panel} aria-label="Azure sign-in required">
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
        <Button
          type="button"
          appearance="primary"
          className={styles.loginButton}
          title="Start Azure login in your browser."
          onClick={() => {
            void onAzureLogin();
          }}
          disabled={isStartingAzureLogin}
        >
          {isStartingAzureLogin ? "Starting Azure Login..." : "Azure Login"}
        </Button>
      </div>
    </section>
  );
}
