/**
 * Client UI component module.
 */
import configStyles from "~/components/shared/ConfigSection.module.css";
import { SelectableCardList, type SelectableCardItem } from "~/components/shared/SelectableCardList";
import { SubSection } from "~/components/shared/SubSection";
import styles from "~/components/shared/CollapsibleSelectableCardGroupList.module.css";

export type CollapsibleSelectableCardGroup = {
  id: string;
  label: string;
  description?: string;
  externalHref?: string;
  externalLabel?: string;
  items: SelectableCardItem[];
  listAriaLabel: string;
  emptyHint: string;
  addButtonLabel?: string;
  selectedButtonLabel?: string;
  onToggleItem: (id: string) => void;
};

type CollapsibleSelectableCardGroupListProps = {
  groups: CollapsibleSelectableCardGroup[];
  emptyHint: string;
  isActionDisabled: boolean;
};

export function CollapsibleSelectableCardGroupList(
  props: CollapsibleSelectableCardGroupListProps,
) {
  const { groups, emptyHint, isActionDisabled } = props;
  const visibleGroups = groups.filter((group) => group.items.length > 0);

  if (visibleGroups.length === 0) {
    return <p className={configStyles.fieldHint}>{emptyHint}</p>;
  }

  return (
    <div className={styles.list}>
      {visibleGroups.map((group) => {
        const externalHref = readHttpUrl(group.externalHref);
        const summaryActions = externalHref ? (
          <a
            className={styles.externalLink}
            href={externalHref}
            target="_blank"
            rel="noreferrer"
            title={group.externalLabel ?? `Open ${group.label} registry`}
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <span className={styles.externalLinkGlyph} aria-hidden="true">
              ↗
            </span>
          </a>
        ) : undefined;

        return (
          <SubSection
            key={group.id}
            className={styles.group}
            contentClassName={styles.groupContent}
            title={group.label}
            description={group.description}
            summaryActions={summaryActions}
          >
            <SelectableCardList
              items={group.items}
              listAriaLabel={group.listAriaLabel}
              emptyHint={group.emptyHint}
              isActionDisabled={isActionDisabled}
              onToggleItem={group.onToggleItem}
              addButtonLabel={group.addButtonLabel}
              selectedButtonLabel={group.selectedButtonLabel}
            />
          </SubSection>
        );
      })}
    </div>
  );
}

function readHttpUrl(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalizedValue = value.trim();
  if (!/^https?:\/\//.test(normalizedValue)) {
    return null;
  }

  return normalizedValue;
}
