/**
 * Client UI component module.
 */
import { clsx } from "clsx";
import type { ReactNode } from "react";
import { InfoIconButton } from "~/components/shared/InfoIconButton";
import { LabeledTooltip } from "~/components/shared/LabeledTooltip";
import styles from "~/components/shared/ConfigSection.module.css";

type ConfigSectionProps = {
  title: string;
  description?: string;
  className?: string;
  children: ReactNode;
};

export function ConfigSection(props: ConfigSectionProps) {
  const { title, description, className, children } = props;
  const normalizedDescription = description?.trim() ?? "";

  return (
    <section className={clsx(styles.root, className)}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h3 className={styles.title}>{title}</h3>
          {normalizedDescription ? (
            <LabeledTooltip
              title={`${title} Description`}
              lines={[normalizedDescription]}
              className={styles.tooltipTarget}
            >
              <InfoIconButton
                className={styles.tooltipIcon}
                ariaLabel={`${title} description`}
                title={`${title} description`}
              />
            </LabeledTooltip>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}
