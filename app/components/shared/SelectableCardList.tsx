/**
 * Client UI component module.
 */
import { clsx } from "clsx";
import configStyles from "~/components/shared/ConfigSection.module.css";
import { InfoIconButton } from "~/components/shared/InfoIconButton";
import { LabeledTooltip } from "~/components/shared/LabeledTooltip";
import {
  ContextActionMenu,
  type ContextActionMenuItem,
} from "~/components/shared/ContextActionMenu";
import { FluentUI } from "~/components/shared/fluent";
import styles from "~/components/shared/SelectableCardList.module.css";

const { Button } = FluentUI;

export type SelectableCardItem = {
  id: string;
  name: string;
  badge?: string;
  description: string;
  detail: string;
  isSelected: boolean;
  isAvailable: boolean;
  selectedActionLabel?: string;
  selectedActionTitle?: string;
};

type SelectableCardListProps = {
  items: SelectableCardItem[];
  listAriaLabel: string;
  emptyHint: string;
  isActionDisabled: boolean;
  onToggleItem: (id: string) => void;
  addButtonLabel?: string;
  selectedButtonLabel?: string;
  buildContextMenuItems?: (item: SelectableCardItem) => ContextActionMenuItem[];
};

export function SelectableCardList(props: SelectableCardListProps) {
  const {
    items,
    listAriaLabel,
    emptyHint,
    isActionDisabled,
    onToggleItem,
    addButtonLabel = "Add",
    selectedButtonLabel = "Added",
    buildContextMenuItems,
  } = props;

  if (items.length === 0) {
    return <p className={configStyles.fieldHint}>{emptyHint}</p>;
  }

  return (
    <div className={styles.list} role="list" aria-label={listAriaLabel}>
      {items.map((item) => {
        const description = item.description.trim();
        const detail = item.detail.trim();
        const tooltipLines = [description, detail].filter((line) => line.length > 0);
        const contextMenuItems = buildContextMenuItems ? buildContextMenuItems(item) : [];
        const selectedActionLabel =
          typeof item.selectedActionLabel === "string" && item.selectedActionLabel.trim()
            ? item.selectedActionLabel.trim()
            : selectedButtonLabel;
        const selectedActionTitle =
          typeof item.selectedActionTitle === "string" && item.selectedActionTitle.trim()
            ? item.selectedActionTitle.trim()
            : `Remove ${item.name}`;

        const renderCardContent = (key?: string) => (
          <article
            key={key}
            role="listitem"
            className={clsx(
              styles.item,
              item.isSelected && styles.itemSelected,
              !item.isAvailable && styles.itemUnavailable,
            )}
          >
            <div className={styles.itemTopRow}>
              <div className={styles.itemTitleRow}>
                <p className={styles.name}>{item.name}</p>
                {item.badge ? <span className={styles.badge}>{item.badge}</span> : null}
                {tooltipLines.length > 0 ? (
                  <LabeledTooltip
                    title={`${item.name} Details`}
                    lines={tooltipLines}
                    className={styles.tooltipTarget}
                  >
                    <InfoIconButton
                      className={styles.tooltipIcon}
                      ariaLabel={`${item.name} details`}
                      title={`${item.name} details`}
                    />
                  </LabeledTooltip>
                ) : null}
              </div>
              <Button
                type="button"
                appearance={item.isSelected ? "subtle" : "secondary"}
                size="small"
                className={clsx(
                  styles.addButton,
                  item.isSelected && styles.addButtonSelected,
                )}
                onClick={() => {
                  onToggleItem(item.id);
                }}
                disabled={isActionDisabled || (!item.isAvailable && !item.isSelected)}
                title={item.isSelected ? selectedActionTitle : `Add ${item.name}`}
              >
                {item.isSelected ? selectedActionLabel : addButtonLabel}
              </Button>
            </div>
          </article>
        );

        if (contextMenuItems.length > 0) {
          return (
            <ContextActionMenu
              key={item.id}
              menuLabel={`Actions for ${item.name}`}
              items={contextMenuItems}
            >
              {renderCardContent()}
            </ContextActionMenu>
          );
        }

        return renderCardContent(item.id);
      })}
    </div>
  );
}
