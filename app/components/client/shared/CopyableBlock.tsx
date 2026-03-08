/**
 * Client UI component module.
 */
import type { ReactNode } from "react";
import { CopyIconButton } from "~/components/client/shared/CopyIconButton";

type CopyableBlockProps = {
  ariaLabel: string;
  title: string;
  copyText: string;
  className?: string;
  onCopyText: (text: string) => void;
  children: ReactNode;
};

function buildClassName(...values: Array<string | undefined>): string {
  return values.filter((value) => value && value.trim().length > 0).join(" ");
}

export function CopyableBlock(props: CopyableBlockProps) {
  const { ariaLabel, title, copyText, className, onCopyText, children } = props;
  const isCopyDisabled = copyText.length === 0;

  return (
    <div className={buildClassName("copyable-block", className)}>
      {children}
      <div className="copyable-block-toolbar">
        <CopyIconButton
          className="copyable-block-copy-btn"
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
