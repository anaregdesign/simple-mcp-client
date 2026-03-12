/**
 * Client UI component module.
 */
import type { ComponentProps } from "react";
import styles from "~/components/config/ConfigPanel.module.css";
import { FluentUI } from "~/components/shared/fluent";
import { McpServersTab } from "~/components/config/mcp/McpServersTab";
import { SkillsTab } from "~/components/config/skills/SkillsTab";
import { SettingsTab } from "~/components/config/settings/SettingsTab";
import { ThreadsTab } from "~/components/config/threads/ThreadsTab";
import type { MainViewTab } from "~/lib/client/usecase/workspace/config-panel/main-view-tab";
import { CLIENT_CONFIG_TAB_OPTIONS } from "~/lib/constants/client";

const { MessageBar, MessageBarBody, Tab, TabList } = FluentUI;

type ConfigPanelProps = {
  chrome: {
    activeMainTab: MainViewTab;
    onMainTabChange: (nextTab: MainViewTab) => void;
    isChatLocked: boolean;
  };
  tabs: {
    settings: Omit<ComponentProps<typeof SettingsTab>, "activeMainTab">;
    mcpServers: Omit<ComponentProps<typeof McpServersTab>, "activeMainTab">;
    skills: Omit<ComponentProps<typeof SkillsTab>, "activeMainTab">;
    threads: Omit<ComponentProps<typeof ThreadsTab>, "activeMainTab">;
  };
};

export function ConfigPanel(props: ConfigPanelProps) {
  const {
    chrome,
    tabs,
  } = props;
  const {
    activeMainTab,
    onMainTabChange,
    isChatLocked,
  } = chrome;

  function renderActiveMainTab() {
    if (activeMainTab === "threads") {
      return <ThreadsTab activeMainTab={activeMainTab} {...tabs.threads} />;
    }

    if (activeMainTab === "mcp") {
      return <McpServersTab activeMainTab={activeMainTab} {...tabs.mcpServers} />;
    }

    if (activeMainTab === "skills") {
      return <SkillsTab activeMainTab={activeMainTab} {...tabs.skills} />;
    }

    return <SettingsTab activeMainTab={activeMainTab} {...tabs.settings} />;
  }

  return (
    <aside className={styles.root} aria-label="Configuration panels">
      <div className={styles.header}>
        <TabList
          className={styles.tabs}
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
              className={styles.tabButton}
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
          <MessageBar intent="warning" className={styles.guidanceBar}>
            <MessageBarBody>
              🔒 Playground is locked. Open Settings and sign in to Azure.
            </MessageBarBody>
          </MessageBar>
        ) : null}
      </div>
      <div className={styles.body}>
        <div className={styles.topPanel}>{renderActiveMainTab()}</div>
      </div>
    </aside>
  );
}
