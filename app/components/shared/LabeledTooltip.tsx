/**
 * Client UI component module.
 */
import { clsx } from "clsx";
import type { ReactNode } from "react";
import { FluentUI } from "~/components/shared/fluent";
import styles from "~/components/shared/LabeledTooltip.module.css";

const { Tooltip } = FluentUI;

type LabeledTooltipProps = {
  title: string;
  lines?: ReactNode[];
  className?: string;
  children: ReactNode;
};

export function LabeledTooltip(props: LabeledTooltipProps) {
  const { title, lines = [], className, children } = props;

  return (
    <Tooltip
      relationship="description"
      showDelay={0}
      positioning="above-start"
      content={
        <div className={styles.content}>
          <p className={styles.title}>{title}</p>
          {lines.map((line, index) => (
            <p key={`${title}-${index}`} className={styles.line}>
              {line}
            </p>
          ))}
        </div>
      }
    >
      <div className={clsx(styles.target, className)}>{children}</div>
    </Tooltip>
  );
}
