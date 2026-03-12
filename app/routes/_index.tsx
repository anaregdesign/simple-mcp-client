/**
 * Route composition module.
 */
import type { CSSProperties } from "react";
import { clsx } from "clsx";
import { AzureAuthPendingPanel } from "~/components/authorize/AzureAuthPendingPanel";
import { ConfigPanel } from "~/components/config/ConfigPanel";
import { UnauthenticatedPanel } from "~/components/authorize/UnauthenticatedPanel";
import { PlaygroundPanel } from "~/components/playground/PlaygroundPanel";
import {
  renderMessageContent,
  renderTurnOperationLog,
} from "~/components/playground/PlaygroundRenderers";
import { FluentUI } from "~/components/shared/fluent";
import { useWorkspace } from "~/lib/client/usecase/workspace/use-workspace";
import type { Route } from "./+types/_index";
import styles from "./_index.module.css";

const { FluentProvider, webDarkTheme, webLightTheme } = FluentUI;

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Local Playground" },
    { name: "description", content: "Local desktop playground with OpenAI backend." },
  ];
}

export default function Home() {
  const {
    screen,
  } = useWorkspace();

  const fluentTheme = screen.theme === "dark" ? webDarkTheme : webLightTheme;

  if (screen.auth.isResolvingAzureAuth) {
    return (
      <FluentProvider theme={fluentTheme}>
        <main className={clsx(styles.page, styles.unauthPage)}>
          <AzureAuthPendingPanel />
        </main>
      </FluentProvider>
    );
  }

  if (screen.auth.isAzureAuthRequired) {
    return (
      <FluentProvider theme={fluentTheme}>
        <main className={clsx(styles.page, styles.unauthPage)}>
          <UnauthenticatedPanel {...screen.auth.unauthenticatedPanelProps} />
        </main>
      </FluentProvider>
    );
  }

  return (
    <FluentProvider theme={fluentTheme}>
      <main className={styles.page}>
        <div
          className={clsx(styles.layout, styles.workspaceLayout)}
          ref={screen.layout.layoutRef}
          style={
            {
              "--right-pane-width": `${screen.layout.rightPaneWidth}px`,
            } as CSSProperties
          }
        >
          <PlaygroundPanel
            header={screen.playground.header}
            conversation={{
              ...screen.playground.conversation,
              renderMessageContent,
              renderTurnOperationLog,
            }}
            composer={screen.playground.composer}
          />

          <div
            className={clsx(
              styles.mainSplitter,
              screen.layout.isMainSplitterResizing && styles.splitterResizing,
            )}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize panels"
            title="Drag to resize Playground and side panels."
            onPointerDown={screen.layout.onMainSplitterPointerDown}
          />

          <ConfigPanel {...screen.config} />
        </div>
      </main>
    </FluentProvider>
  );
}
