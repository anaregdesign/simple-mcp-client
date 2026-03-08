/**
 * Route composition module.
 */
import type { CSSProperties } from "react";
import { ConfigPanel } from "~/components/client/config/ConfigPanel";
import { UnauthenticatedPanel } from "~/components/client/authorize/UnauthenticatedPanel";
import { PlaygroundPanel } from "~/components/client/playground/PlaygroundPanel";
import {
  renderMessageContent,
  renderTurnOperationLog,
} from "~/components/client/playground/PlaygroundRenderers";
import { FluentUI } from "~/components/client/shared/fluent";
import { useWorkspaceClientController } from "~/lib/client/controller/use-workspace-client-controller";
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
    layoutRef,
    rightPaneWidth,
    isMainSplitterResizing,
    onMainSplitterPointerDown,
    isAzureAuthRequired,
    theme,
    unauthenticatedPanelProps,
    configPanelProps,
    playgroundPanelProps,
  } = useWorkspaceClientController();

  const fluentTheme = theme === "dark" ? webDarkTheme : webLightTheme;

  if (isAzureAuthRequired) {
    return (
      <FluentProvider theme={fluentTheme}>
        <main className="chat-page chat-page-unauth">
          <UnauthenticatedPanel {...unauthenticatedPanelProps} />
        </main>
      </FluentProvider>
    );
  }

  return (
    <FluentProvider theme={fluentTheme}>
      <main className="chat-page">
        <div
          className="chat-layout workspace-layout"
          ref={layoutRef}
          style={
            {
              "--right-pane-width": `${rightPaneWidth}px`,
            } as CSSProperties
          }
        >
          <PlaygroundPanel
            {...playgroundPanelProps}
            renderMessageContent={renderMessageContent}
            renderTurnOperationLog={renderTurnOperationLog}
          />

          <div
            className={`layout-splitter main-splitter ${isMainSplitterResizing ? "resizing" : ""}`}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize panels"
            title="Drag to resize Playground and side panels."
            onPointerDown={onMainSplitterPointerDown}
          />

          <ConfigPanel {...configPanelProps} />
        </div>
      </main>
    </FluentProvider>
  );
}
