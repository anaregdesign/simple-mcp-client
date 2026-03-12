/**
 * Client UI component module.
 */
import { clsx } from "clsx";
import type { MouseEventHandler } from "react";
import { SymbolIconButton } from "~/components/shared/SymbolIconButton";
import styles from "~/components/shared/CopyIconButton.module.css";

type CopyIconButtonProps = {
  ariaLabel: string;
  title: string;
  className?: string;
  disabled?: boolean;
  onClick: MouseEventHandler<HTMLButtonElement>;
};

export function CopyIconButton(props: CopyIconButtonProps) {
  const { ariaLabel, title, className, disabled = false, onClick } = props;

  return (
    <SymbolIconButton
      ariaLabel={ariaLabel}
      title={title}
      className={clsx(styles.root, className)}
      disabled={disabled}
      onClick={onClick}
      symbol="⎘"
    />
  );
}
