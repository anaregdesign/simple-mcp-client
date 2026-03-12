/**
 * Client UI component module.
 */
import { clsx } from "clsx";
import { CopyableAutoDismissStatusMessageList } from "~/components/CopyableAutoDismissStatusMessageList";
import {
  CollapsibleSelectableCardGroupList,
  type CollapsibleSelectableCardGroup,
} from "~/components/shared/CollapsibleSelectableCardGroupList";
import { ConfigSection } from "~/components/shared/ConfigSection";
import { FluentUI } from "~/components/shared/fluent";
import configStyles from "~/components/shared/ConfigSection.module.css";
import selectableStyles from "~/components/shared/SelectableCardList.module.css";
import type { SkillCatalogSource } from "~/lib/contracts/skills/types";
import styles from "~/components/config/skills/SkillsSection.module.css";

const { Button, Spinner } = FluentUI;

export type ThreadSkillOption = {
  name: string;
  description: string;
  location: string;
  source: SkillCatalogSource;
  badge: string;
  isSelected: boolean;
  isAvailable: boolean;
};

type SkillsSectionProps = {
  skillOptions: ThreadSkillOption[];
  isLoadingSkills: boolean;
  isSending: boolean;
  isThreadReadOnly: boolean;
  skillsError: string | null;
  skillsWarning: string | null;
  onReloadSkills: () => void;
  onToggleSkill: (location: string) => void;
  onClearSkillsWarning: () => void;
};

export function SkillsSection(props: SkillsSectionProps) {
  const {
    skillOptions,
    isLoadingSkills,
    isSending,
    isThreadReadOnly,
    skillsError,
    skillsWarning,
    onReloadSkills,
    onToggleSkill,
    onClearSkillsWarning,
  } = props;

  const groupedSkillMap = new Map<string, ThreadSkillOption[]>();
  for (const skill of skillOptions) {
    const groupName = skill.badge || "Skills";
    const list = groupedSkillMap.get(groupName) ?? [];
    list.push(skill);
    groupedSkillMap.set(groupName, list);
  }
  const groupedSkills = Array.from(groupedSkillMap.entries())
    .sort(
      ([left], [right]) =>
        readSkillGroupPriority(left) - readSkillGroupPriority(right) ||
        left.localeCompare(right),
    )
    .map(([groupName, groupSkills]) => {
      const items = groupSkills.map((skill) => ({
        id: skill.location,
        name: skill.name,
        description: skill.description,
        detail: skill.location,
        isSelected: skill.isSelected,
        isAvailable: skill.isAvailable,
      }));

      const group: CollapsibleSelectableCardGroup = {
        id: groupName,
        label: groupName,
        description: readSkillGroupDescription(groupName),
        items,
        listAriaLabel: `Thread Skills (${groupName})`,
        emptyHint: `No Skills in ${groupName}.`,
        onToggleItem: onToggleSkill,
      };
      return group;
    });

  return (
    <ConfigSection
      className={styles.root}
      title="Skills 🧠"
      description="Enable agentskills-compatible SKILL.md instructions for the current thread."
    >
      {isThreadReadOnly ? (
        <p className={configStyles.fieldHint}>
          This thread is archived and read-only. Restore it from Archives to edit skill selections.
        </p>
      ) : null}
      <div className={clsx(selectableStyles.headerRow, selectableStyles.headerRowRight)}>
        <Button
          type="button"
          appearance="subtle"
          size="small"
          className={selectableStyles.reloadButton}
          title="Reload skill list from local skills directories."
          onClick={onReloadSkills}
          disabled={isLoadingSkills || isSending}
        >
          ↻ Reload
        </Button>
      </div>
      {isLoadingSkills ? (
        <div className={configStyles.loadingNotice} role="status" aria-live="polite">
          <Spinner size="tiny" />
          Loading Skills...
        </div>
      ) : null}
      <CollapsibleSelectableCardGroupList
        groups={groupedSkills}
        emptyHint="No Skills discovered in CODEX_HOME or app data skills directories."
        isActionDisabled={isSending || isThreadReadOnly}
      />
      <CopyableAutoDismissStatusMessageList
        messages={[
          { intent: "error", text: skillsError },
          {
            intent: "warning",
            text: skillsWarning,
            onClear: onClearSkillsWarning,
          },
        ]}
      />
    </ConfigSection>
  );
}

function readSkillGroupPriority(groupName: string): number {
  switch (groupName) {
    case "Workspace":
      return 1;
    case "CODEX_HOME":
      return 2;
    case "OpenAI Curated":
      return 3;
    case "Anthropic Public":
      return 4;
    case "App Data":
      return 5;
    default:
      return 9;
  }
}

function readSkillGroupDescription(groupName: string): string {
  switch (groupName) {
    case "Workspace":
      return "Skills installed from the Workspace registry.";
    case "CODEX_HOME":
      return "Skills discovered from shared CODEX_HOME directories.";
    case "OpenAI Curated":
      return "Skills installed from openai/skills (.curated).";
    case "Anthropic Public":
      return "Skills installed from anthropics/skills.";
    case "App Data":
      return "Skills discovered from app data shared directories.";
    default:
      return "";
  }
}
