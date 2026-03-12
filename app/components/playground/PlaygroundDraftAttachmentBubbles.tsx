import { FluentUI } from "~/components/shared/fluent";
import { formatPlaygroundAttachmentSize } from "~/components/playground/rendering/attachment-size";
import type { ThreadMessageAttachmentView } from "~/lib/client/usecase/workspace/playground-panel/view-types";
import styles from "~/components/playground/PlaygroundDraftAttachmentBubbles.module.css";

const { Button } = FluentUI;

type PlaygroundDraftAttachmentBubblesProps = {
  messageAttachments: ThreadMessageAttachmentView[];
  isSending: boolean;
  isThreadReadOnly: boolean;
  onRemoveMessageAttachment: (id: string) => void;
};

export function PlaygroundDraftAttachmentBubbles({
  messageAttachments,
  isSending,
  isThreadReadOnly,
  onRemoveMessageAttachment,
}: PlaygroundDraftAttachmentBubblesProps) {
  if (messageAttachments.length === 0) {
    return null;
  }

  return (
    <section className={styles.strip} aria-label="Attached files">
      <div className={styles.bubbles}>
        {messageAttachments.map((attachment) => (
          <div key={attachment.id} className={styles.item}>
            <span className={styles.bubble}>
              <span className={styles.name}>
                {attachment.name}
              </span>
              <span className={styles.size}>
                {formatPlaygroundAttachmentSize(attachment.sizeBytes)}
              </span>
              <Button
                type="button"
                appearance="subtle"
                size="small"
                className={styles.removeButton}
                onClick={() => onRemoveMessageAttachment(attachment.id)}
                disabled={isSending || isThreadReadOnly}
                aria-label={`Remove attachment ${attachment.name}`}
                title={`Remove ${attachment.name}`}
              >
                ×
              </Button>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
