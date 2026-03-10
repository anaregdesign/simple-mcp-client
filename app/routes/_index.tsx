/**
 * Route composition module.
 */
import type { CSSProperties } from "react";
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

  if (screen.auth.isAzureAuthRequired) {
    return (
      <FluentProvider theme={fluentTheme}>
        <main className="chat-page chat-page-unauth">
          <UnauthenticatedPanel {...screen.auth.unauthenticatedPanelProps} />
        </main>
      </FluentProvider>
    );
  }

  return (
    <FluentProvider theme={fluentTheme}>
      <main className="chat-page">
        <div
          className="chat-layout workspace-layout"
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
            className={`layout-splitter main-splitter ${screen.layout.isMainSplitterResizing ? "resizing" : ""}`}
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
