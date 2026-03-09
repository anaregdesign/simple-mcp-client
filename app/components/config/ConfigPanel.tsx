/**
 * Client UI component module.
 */
import type { ComponentProps } from "react";
import { FluentUI } from "~/components/shared/fluent";
import { McpServersTab } from "~/components/config/mcp/McpServersTab";
import { SkillsTab } from "~/components/config/skills/SkillsTab";
import { SettingsTab } from "~/components/config/settings/SettingsTab";
import { ThreadsTab } from "~/components/config/threads/ThreadsTab";
import type { MainViewTab } from "~/lib/client/usecase/workspace/view-types";
import { CLIENT_CONFIG_TAB_OPTIONS } from "~/lib/constants/client";

const { MessageBar, MessageBarBody, Tab, TabList } = FluentUI;

type ConfigPanelProps = {
  activeMainTab: MainViewTab;
  onMainTabChange: (nextTab: MainViewTab) => void;
  isChatLocked: boolean;
  settingsTabProps: Omit<ComponentProps<typeof SettingsTab>, "activeMainTab">;
  mcpServersTabProps: Omit<
    ComponentProps<typeof McpServersTab>,
    "activeMainTab"
  >;
  skillsTabProps: Omit<ComponentProps<typeof SkillsTab>, "activeMainTab">;
  threadsTabProps: Omit<ComponentProps<typeof ThreadsTab>, "activeMainTab">;
};

export function ConfigPanel(props: ConfigPanelProps) {
  const {
    activeMainTab,
    onMainTabChange,
    isChatLocked,
    settingsTabProps,
    mcpServersTabProps,
    skillsTabProps,
    threadsTabProps,
  } = props;

  function renderActiveMainTab() {
    if (activeMainTab === "threads") {
      return <ThreadsTab activeMainTab={activeMainTab} {...threadsTabProps} />;
    }

    if (activeMainTab === "mcp") {
      return (
        <McpServersTab activeMainTab={activeMainTab} {...mcpServersTabProps} />
      );
    }

    if (activeMainTab === "skills") {
      return <SkillsTab activeMainTab={activeMainTab} {...skillsTabProps} />;
    }

    return <SettingsTab activeMainTab={activeMainTab} {...settingsTabProps} />;
  }

  return (
    <aside className="side-shell main-panel" aria-label="Configuration panels">
      <div className="side-shell-header">
        <TabList
          className="main-tabs"
          aria-label="Side panels"
          appearance="subtle"
          size="small"
          title="Switch side panel content."
          selectedValue={activeMainTab}
          onTabSelect={(_, data) => {
            const nextTab = String(data.value);
            if (
              nextTab === "settings" ||
              nextTab === "mcp" ||
              nextTab === "skills" ||
              nextTab === "threads"
            ) {
              onMainTabChange(nextTab);
            }
          }}
        >
          {CLIENT_CONFIG_TAB_OPTIONS.map((tab) => (
            <Tab
              key={tab.id}
              value={tab.id}
              id={`tab-${tab.id}`}
              aria-controls={`panel-${tab.id}`}
              className="main-tab-btn"
              title={
                tab.id === "settings"
                  ? "Open Settings panel."
                  : tab.id === "skills"
                    ? "Open Skills panel."
                    : tab.id === "mcp"
                      ? "Open MCP Servers panel."
                      : "Open Threads panel."
              }
            >
              {tab.label}
            </Tab>
          ))}
        </TabList>
        {isChatLocked ? (
          <MessageBar intent="warning" className="tab-guidance-bar">
            <MessageBarBody>
              🔒 Playground is locked. Open Settings and sign in to Azure.
            </MessageBarBody>
          </MessageBar>
        ) : null}
      </div>
      <div className="side-shell-body">
        <div className="side-top-panel">{renderActiveMainTab()}</div>
      </div>
    </aside>
  );
}
