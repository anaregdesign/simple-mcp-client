/**
 * Client UI component module.
 */
import type { ComponentProps } from "react";
import { AppearanceSection } from "~/components/client/config/settings/AppearanceSection";
import { AzureConnectionSection } from "~/components/client/config/settings/AzureConnectionSection";
import { UtilityModelSection } from "~/components/client/config/settings/UtilityModelSection";
import type { MainViewTab } from "~/lib/client/shared/view-types";

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
      className="settings-shell"
      aria-label="Playground settings"
      id="panel-settings"
      role="tabpanel"
      aria-labelledby="tab-settings"
      hidden={activeMainTab !== "settings"}
    >
      <div className="settings-content">
        <UtilityModelSection {...utilityModelSectionProps} />
        <AppearanceSection {...appearanceSectionProps} />
        <AzureConnectionSection {...azureConnectionSectionProps} />
      </div>
    </section>
  );
}
