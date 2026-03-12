/**
 * Client UI component module.
 */
import { clsx } from "clsx";
import type { ReactNode } from "react";
import styles from "~/components/shared/QuickControlFrame.module.css";

type QuickControlFrameProps = {
  className?: string;
  children: ReactNode;
};

export function QuickControlFrame(props: QuickControlFrameProps) {
  const { className, children } = props;

  return <div className={clsx(styles.root, className)}>{children}</div>;
}
