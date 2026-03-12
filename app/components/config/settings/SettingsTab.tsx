/**
 * Client UI component module.
 */
import type { ComponentProps } from "react";
import styles from "~/components/config/ConfigTabPanel.module.css";
import { AppearanceSection } from "~/components/config/settings/AppearanceSection";
import { AzureConnectionSection } from "~/components/config/settings/AzureConnectionSection";
import { UtilityModelSection } from "~/components/config/settings/UtilityModelSection";
import type { MainViewTab } from "~/lib/client/usecase/workspace/config-panel/main-view-tab";

type SettingsTabProps = {
  activeMainTab: MainViewTab;
  appearanceSectionProps: ComponentProps<typeof AppearanceSection>;
  azureConnectionSectionProps: ComponentProps<typeof AzureConnectionSection>;
  utilityModelSectionProps: ComponentProps<typeof UtilityModelSection>;
};

export function SettingsTab(props: SettingsTabProps) {
  const {
    activeMainTab,
    appearanceSectionProps,
    azureConnectionSectionProps,
    utilityModelSectionProps,
  } = props;

  return (
    <section
      className={styles.shell}
      aria-label="Playground settings"
      id="panel-settings"
      role="tabpanel"
      aria-labelledby="tab-settings"
      hidden={activeMainTab !== "settings"}
    >
      <div className={styles.content}>
        <UtilityModelSection {...utilityModelSectionProps} />
        <AzureConnectionSection {...azureConnectionSectionProps} />
        <AppearanceSection {...appearanceSectionProps} />
      </div>
    </section>
  );
}
