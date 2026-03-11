/**
 * Client UI component module.
 */
import type { ReactNode } from "react";
import { InfoIconButton } from "~/components/shared/InfoIconButton";
import { LabeledTooltip } from "~/components/shared/LabeledTooltip";

type SubSectionProps = {
  title: string;
  description?: string;
  className?: string;
  contentClassName?: string;
  summaryActions?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
};

function buildClassName(...values: Array<string | undefined>): string {
  return values.filter((value) => value && value.trim().length > 0).join(" ");
}

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
      className={buildClassName("subsection", className)}
      open={defaultOpen ? true : undefined}
    >
      <summary className="subsection-summary">
        <div className="subsection-title-row">
          <h4 className="subsection-title">{title}</h4>
          {normalizedDescription ? (
            <LabeledTooltip
              title={`${title} Description`}
              lines={[normalizedDescription]}
              className="setting-group-tooltip-target"
            >
              <InfoIconButton
                className="setting-group-tooltip-icon"
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
        <span className="subsection-summary-actions">
          {summaryActions}
          <span className="subsection-caret symbol-icon-btn" aria-hidden="true">
            <span className="symbol-icon-btn-glyph">▸</span>
          </span>
        </span>
      </summary>
      <div className={buildClassName("subsection-content", contentClassName)}>{children}</div>
    </details>
  );
}
