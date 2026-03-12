import type { ReactNode } from "react";
import { LabeledTooltip } from "~/components/shared/LabeledTooltip";

type PlaygroundControlTooltipProps = {
  title: string;
  lines: ReactNode[];
  children: ReactNode;
  className?: string;
};

export function PlaygroundControlTooltip({
  title,
  lines,
  children,
  className,
}: PlaygroundControlTooltipProps) {
  return (
    <LabeledTooltip title={title} lines={lines} className={className}>
      {children}
    </LabeledTooltip>
  );
}
