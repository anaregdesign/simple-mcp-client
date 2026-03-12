/**
 * Client UI component module.
 */
import { clsx } from "clsx";
import type { ReactNode } from "react";
import { CopyIconButton } from "~/components/shared/CopyIconButton";
import styles from "~/components/shared/CopyableBlock.module.css";

type CopyableBlockProps = {
  ariaLabel: string;
  title: string;
  copyText: string;
  className?: string;
  onCopyText: (text: string) => void;
  children: ReactNode;
};

export function CopyableBlock(props: CopyableBlockProps) {
  const { ariaLabel, title, copyText, className, onCopyText, children } = props;
  const isCopyDisabled = copyText.length === 0;

  return (
    <div className={clsx(styles.root, className)}>
      {children}
      <div className={styles.toolbar}>
        <CopyIconButton
          className={styles.copyButton}
          ariaLabel={ariaLabel}
          title={title}
          disabled={isCopyDisabled}
          onClick={() => {
            onCopyText(copyText);
          }}
        />
      </div>
    </div>
  );
}
