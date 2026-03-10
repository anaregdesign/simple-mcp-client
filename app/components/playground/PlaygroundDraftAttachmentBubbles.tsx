import { FluentUI } from "~/components/shared/fluent";
import { formatPlaygroundAttachmentSize } from "~/components/playground/rendering/attachment-size";
import type { ThreadMessageAttachmentView } from "~/lib/client/usecase/workspace/view-types";

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
    <section className="chat-attachment-strip" aria-label="Attached files">
      <div className="chat-attachment-bubbles">
        {messageAttachments.map((attachment) => (
          <div key={attachment.id} className="chat-attachment-bubble-item">
            <span className="chat-attachment-bubble">
              <span className="chat-attachment-bubble-name">
                {attachment.name}
              </span>
              <span className="chat-attachment-bubble-size">
                {formatPlaygroundAttachmentSize(attachment.sizeBytes)}
              </span>
              <Button
                type="button"
                appearance="subtle"
                size="small"
                className="chat-attachment-bubble-remove"
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
