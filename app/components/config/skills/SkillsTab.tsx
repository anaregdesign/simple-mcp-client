/**
 * Client UI component module.
 */
import type { ComponentProps } from "react";
import { SkillRegistrySection } from "~/components/config/skills/SkillRegistrySection";
import { SkillsSection } from "~/components/config/skills/SkillsSection";
import type { MainViewTab } from "~/lib/client/shared/view-types";

type SkillsTabProps = {
  activeMainTab: MainViewTab;
  skillsSectionProps: ComponentProps<typeof SkillsSection>;
  skillRegistrySectionProps: ComponentProps<typeof SkillRegistrySection>;
};

export function SkillsTab(props: SkillsTabProps) {
  const { activeMainTab, skillsSectionProps, skillRegistrySectionProps } = props;

  return (
    <section
      className="skills-shell"
      aria-label="Skill settings"
      id="panel-skills"
      role="tabpanel"
      aria-labelledby="tab-skills"
      hidden={activeMainTab !== "skills"}
    >
      <div className="skills-content">
        <SkillsSection {...skillsSectionProps} />
        <SkillRegistrySection {...skillRegistrySectionProps} />
      </div>
    </section>
  );
}
