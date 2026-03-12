/**
 * Client UI component module.
 */
import type { ComponentProps } from "react";
import styles from "~/components/config/ConfigTabPanel.module.css";
import { SkillRegistrySection } from "~/components/config/skills/SkillRegistrySection";
import { SkillsSection } from "~/components/config/skills/SkillsSection";
import type { MainViewTab } from "~/lib/client/usecase/workspace/config-panel/main-view-tab";

type SkillsTabProps = {
  activeMainTab: MainViewTab;
  skillsSectionProps: ComponentProps<typeof SkillsSection>;
  skillRegistrySectionProps: ComponentProps<typeof SkillRegistrySection>;
};

export function SkillsTab(props: SkillsTabProps) {
  const { activeMainTab, skillsSectionProps, skillRegistrySectionProps } = props;

  return (
    <section
      className={styles.shell}
      aria-label="Skill settings"
      id="panel-skills"
      role="tabpanel"
      aria-labelledby="tab-skills"
      hidden={activeMainTab !== "skills"}
    >
      <div className={styles.content}>
        <SkillsSection {...skillsSectionProps} />
        <SkillRegistrySection {...skillRegistrySectionProps} />
      </div>
    </section>
  );
}
