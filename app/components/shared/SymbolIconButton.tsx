/**
 * Client UI component module.
 */
import { clsx } from "clsx";
import type { MouseEventHandler, ReactNode } from "react";
import { FluentUI } from "~/components/shared/fluent";
import styles from "~/components/shared/SymbolIconButton.module.css";

const { Button } = FluentUI;

type SymbolIconButtonProps = {
  ariaLabel: string;
  title: string;
  symbol: ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
};

export function SymbolIconButton(props: SymbolIconButtonProps) {
  const {
    ariaLabel,
    title,
    symbol,
    className,
    disabled = false,
    onClick,
  } = props;

  return (
    <Button
      type="button"
      appearance="subtle"
      size="small"
      className={clsx(styles.root, className)}
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
      onClick={onClick}
    >
      <span className={styles.glyph} aria-hidden="true">
        {symbol}
      </span>
    </Button>
  );
}
