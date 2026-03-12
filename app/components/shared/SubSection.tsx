/**
 * Client UI component module.
 */
import { clsx } from "clsx";
import type { ReactNode } from "react";
import configStyles from "~/components/shared/ConfigSection.module.css";
import { InfoIconButton } from "~/components/shared/InfoIconButton";
import { LabeledTooltip } from "~/components/shared/LabeledTooltip";
import styles from "~/components/shared/SubSection.module.css";

type SubSectionProps = {
  title: string;
  description?: string;
  className?: string;
  contentClassName?: string;
  summaryActions?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
};

export function SubSection(props: SubSectionProps) {
  const {
    title,
    description,
    className,
    contentClassName,
    summaryActions,
    defaultOpen = false,
    children,
  } = props;
  const normalizedDescription = description?.trim() ?? "";

  return (
    <details
      className={clsx(styles.root, className)}
      open={defaultOpen ? true : undefined}
    >
      <summary className={styles.summary}>
        <div className={styles.titleRow}>
          <h4 className={styles.title}>{title}</h4>
          {normalizedDescription ? (
            <LabeledTooltip
              title={`${title} Description`}
              lines={[normalizedDescription]}
              className={configStyles.tooltipTarget}
            >
              <InfoIconButton
                className={configStyles.tooltipIcon}
                ariaLabel={`${title} description`}
                title={`${title} description`}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
              />
            </LabeledTooltip>
          ) : null}
        </div>
        <span className={styles.summaryActions}>
          {summaryActions}
          <span className={styles.caret} aria-hidden="true">
            <span className={styles.caretGlyph}>▸</span>
          </span>
        </span>
      </summary>
      <div className={clsx(styles.content, contentClassName)}>{children}</div>
    </details>
  );
}
